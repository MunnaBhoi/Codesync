import eventlet
eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, join_room, leave_room, emit
import requests
import os
import time
import uuid
import logging
from dotenv import load_dotenv
from openai import OpenAI
from datetime import datetime
import redis
import json

# ----------------- Load .env -----------------
load_dotenv()

# ----------------- Redis Setup -----------------
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
GRACE_TTL = 300  # 5 min grace period for empty rooms

r = None
try:
    # redis.from_url handles redis:// and rediss://; set ssl True for rediss://
    r = redis.from_url(
        REDIS_URL,
        decode_responses=True,
        ssl=REDIS_URL.startswith("rediss://")
    )
    # optional quick sanity check (will raise if fails)
    # r.ping()
except Exception as e:
    logging.getLogger(__name__).warning(f"Redis init failed: {e} | REDIS_URL={REDIS_URL}")
    r = None

def room_files_key(room):
    return f"room:{room}:files"

def room_users_key(room):
    return f"room:{room}:users"

# ----------------- Flask App Setup -----------------
app = Flask(__name__)
CORS(app)

socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    async_mode="eventlet"
)

# ----------------- Logging Setup -----------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# ----------------- Judge0 API Setup -----------------
JUDGE0_URL = os.getenv("JUDGE0_URL", "https://ce.judge0.com")
SUBMISSIONS_URL = f"{JUDGE0_URL}/submissions"

HEADERS = {
    "Content-Type": "application/json",
    "X-RapidAPI-Key": os.getenv("RAPIDAPI_KEY"),
    "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com"
}

# ----------------- OpenAI Setup -----------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_API_KEY)

# ----------------- Utility Routes -----------------
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "CodeSync backend running"})


@app.route("/list_rooms", methods=["GET"])
def list_rooms():
    keys = r.keys("room:*:users")
    rooms = []
    for k in keys:
        room_id = k.split(":")[1]
        users = r.smembers(room_users_key(room_id))
        files_json = r.get(room_files_key(room_id))
        files = json.loads(files_json) if files_json else {}
        rooms.append({"id": room_id, "users": len(users), "files": list(files.keys())})
    return jsonify({"rooms": rooms})


@app.route("/room_info/<room_id>", methods=["GET"])
def room_info(room_id):
    users = r.smembers(room_users_key(room_id))
    if users is None:
        return jsonify({"error": "Room not found"}), 404

    files_json = r.get(room_files_key(room_id)) or "{}"
    return jsonify({
        "room_id": room_id,
        "users": list(users),
        "files": list(json.loads(files_json).keys())
    })


# ----------------- API: Create Room -----------------
@app.route("/create_room", methods=["POST"])
def create_room():
    room_id = str(uuid.uuid4())[:8]
    default_files = {"main.js": {"code": ""}}
    r.set(room_files_key(room_id), json.dumps(default_files))
    r.delete(room_users_key(room_id))
    logger.info(f"Room created: {room_id}")
    return jsonify({"room_id": room_id})

# ----------------- API: Join Room (compat for frontend) -----------------
@app.route("/join_room", methods=["POST"])
def join_room_api():
    try:
        data = request.get_json(force=True)
    except Exception:
        data = request.form.to_dict() or {}

    # accept multiple possible field names your frontend might send
    room_id = data.get("room") or data.get("room_id") or data.get("roomId")
    user = data.get("user") or data.get("username") or f"user-{uuid.uuid4().hex[:5]}"

    if not room_id:
        return jsonify({"error": "room_id required"}), 400

    # If room does not exist in Redis, return error so frontend can show proper message
    files_json = r.get(room_files_key(room_id))
    if not files_json:
        return jsonify({"error": "Room not found"}), 404

    files = json.loads(files_json)
    participants = list(r.smembers(room_users_key(room_id)) or [])

    return jsonify({
        "room_id": room_id,
        "files": files,
        "participants": participants
    })

# ----------------- Judge0 Execution -----------------
@app.route("/run", methods=["POST"])
def run_code():
    try:
        data = request.get_json(force=True)
        source_code = data.get("code", "")
        language_id = data.get("language_id", 63)
        stdin_val = data.get("stdin", "")

        if not source_code.strip():
            return jsonify({"error": "No code provided"}), 400

        payload = {"source_code": source_code, "language_id": language_id, "stdin": stdin_val}

        res = requests.post(SUBMISSIONS_URL, json=payload, headers=HEADERS, timeout=10)
        if res.status_code not in (200, 201):
            return jsonify({"error": f"Judge0 error {res.status_code}", "details": res.text}), res.status_code

        token = res.json().get("token")
        if not token:
            return jsonify({"error": "Judge0 failed to return token"}), 500

        result_url = f"{SUBMISSIONS_URL}/{token}"
        result = None
        for _ in range(10):
            r2 = requests.get(result_url, headers=HEADERS)
            result = r2.json()
            status = result.get("status", {}).get("description", "")
            if status not in ["In Queue", "Processing"]:
                break
            time.sleep(0.5)

        return jsonify({
            "stdout": (result.get("stdout") or "").strip(),
            "stderr": (result.get("stderr") or "").strip(),
            "compile_output": (result.get("compile_output") or "").strip(),
            "status": result.get("status", {}).get("description", "Unknown")
        })

    except Exception as e:
        logger.exception("Unexpected error in /run")
        return jsonify({"error": str(e)}), 500


# ----------------- AI Suggestions -----------------
@app.route("/ai", methods=["POST"])
def ai_suggestions():
    try:
        data = request.get_json(force=True)
        code = data.get("code", "")
        action = data.get("action", "ask")
        target_lang = data.get("target_lang", "")
        concise = data.get("concise", True)
        prompt_text = data.get("prompt", "").strip()

        if action not in ["ask", "convert"]:
            return jsonify({"error": "Invalid action"}), 400

        if action == "ask":
            user_prompt = (
                f"User question:\n{prompt_text or '(none)'}\n\n"
                f"User code:\n{code or '(none)'}\n\n"
                f"{'Be concise.' if concise else 'Explain clearly.'}"
            )

        elif action == "convert":
            if not target_lang:
                return jsonify({"error": "target_lang needed"}), 400
            user_prompt = (
                f"Convert this code into {target_lang}:\n{code}\n\n"
                "Output ONLY the converted code."
            )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": user_prompt}],
            temperature=0.3,
        )

        text = response.choices[0].message.content.strip()
        return jsonify({"result": text})

    except Exception as e:
        logger.exception("AI error")
        return jsonify({"error": str(e)}), 500


# ----------------- Socket.IO Real-Time Sync -----------------

@socketio.on("join_room")
def handle_join(data):
    room = data.get("room")
    user = data.get("user") or f"user-{request.sid[:5]}"
    if not room:
        return

    # Create room if missing
    if not r.exists(room_files_key(room)):
        default_files = {"main.js": {"code": ""}}
        r.set(room_files_key(room), json.dumps(default_files))

    # Add user to room set
    r.sadd(room_users_key(room), user)

    # Persist users key (remove TTL)
    r.persist(room_users_key(room))
    r.persist(room_files_key(room))

    join_room(room)

    # Send initial files
    files = json.loads(r.get(room_files_key(room)))
    emit("init_files", {"files": files}, room=request.sid)

    # Send participants list
    emit("participants_update", {"participants": list(r.smembers(room_users_key(room)))}, room=room)
    emit("system_message", {"msg": f"{user} joined"}, room=room)


@socketio.on("leave_room")
def handle_leave(data):
    room = data.get("room")
    user = data.get("user")
    if not room or not user:
        return

    leave_room(room)

    r.srem(room_users_key(room), user)
    count = r.scard(room_users_key(room))

    if count == 0:
        r.expire(room_users_key(room), GRACE_TTL)
        r.expire(room_files_key(room), GRACE_TTL)

    emit("participants_update", {"participants": list(r.smembers(room_users_key(room)))}, room=room)
    emit("system_message", {"msg": f"{user} left"}, room=room)


@socketio.on("code_change")
def handle_code_change(data):
    room = data.get("room")
    filename = data.get("file")
    code = data.get("code", "")

    if not room or not filename:
        return

    files_json = r.get(room_files_key(room))
    if not files_json:
        return

    files = json.loads(files_json)
    if filename not in files:
        return

    files[filename]["code"] = code
    r.set(room_files_key(room), json.dumps(files))

    emit("code_update", {"file": filename, "code": code}, room=room, include_self=False)


@socketio.on("file_create")
def handle_file_create(data):
    room = data.get("room")
    filename = data.get("filename")

    files = json.loads(r.get(room_files_key(room)))
    files[filename] = {"code": ""}
    r.set(room_files_key(room), json.dumps(files))

    emit("file_created", {"filename": filename}, room=room)


@socketio.on("file_delete")
def handle_file_delete(data):
    room = data.get("room")
    filename = data.get("filename")

    files = json.loads(r.get(room_files_key(room)))
    files.pop(filename, None)
    r.set(room_files_key(room), json.dumps(files))

    emit("file_deleted", {"filename": filename}, room=room)


@socketio.on("file_rename")
def handle_file_rename(data):
    room = data.get("room")
    old = data.get("old")
    new = data.get("new")

    files = json.loads(r.get(room_files_key(room)))
    files[new] = files.pop(old)
    r.set(room_files_key(room), json.dumps(files))

    emit("file_renamed", {"old": old, "new": new}, room=room)


@socketio.on("chat_message")
def handle_chat_message(data):
    room = data.get("room")
    user = data.get("user")
    message = data.get("message")

    msg = {
        "user": user,
        "message": message,
        "timestamp": datetime.now().strftime("%H:%M:%S")
    }
    emit("chat_message", msg, room=room)


@socketio.on("disconnect")
def handle_disconnect():
    # disconnected user = cannot track (frontend must send leave_room)
    pass


# ----------------- Run Server -----------------
if __name__ == "__main__":
    import eventlet
    import eventlet.wsgi
    logger.info("Starting CodeSync backend on http://0.0.0.0:5000")
    socketio.run(app, host="0.0.0.0", port=5000, debug=True)
