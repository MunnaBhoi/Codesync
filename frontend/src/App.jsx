// src/App.jsx
import { useState, useEffect, useRef } from "react";
import socket from "./socket";
import CodeEditor from "./CodeEditor";
import Output from "./Output";
import ChatBox from "./ChatBox";
import { Copy, Trash2, Edit, Play, Cpu, MessageSquare } from "lucide-react";
import { API_BASE } from "./config";

function App() {
  // ----- Core state -----
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");

  // files
  const [files, setFiles] = useState({ "main.js": { code: "" } });
  const [activeFile, setActiveFile] = useState("main.js");

  const [participants, setParticipants] = useState([]);
  const [output, setOutput] = useState("");
  const [language, setLanguage] = useState(63); // default JS
  const [loading, setLoading] = useState(false);

  // AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState("ask");
  const [aiResult, setAiResult] = useState("");
  const [targetLang, setTargetLang] = useState("Python");
  const [aiConcise, setAiConcise] = useState(true);
  const [aiFullscreen, setAiFullscreen] = useState(false);

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);

  // Toasts (minimal local toast system)
  const [toasts, setToasts] = useState([]);
  const toastTimer = useRef({});
  const pushToast = (msg) => {
    if (!msg) return;
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    toastTimer.current[id] = setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      delete toastTimer.current[id];
    }, 3000);
  };

  // Languages
  const languages = [
    { id: 63, name: "JavaScript (Node.js)" },
    { id: 71, name: "Python (3.8)" },
    { id: 62, name: "Java (OpenJDK 13)" },
    { id: 50, name: "C (GCC 9.2)" },
    { id: 54, name: "C++ (GCC 9.2)" },
  ];

  // ----- Layout styling -----
  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = "#0b0f17";
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  // ----- Auto-rejoin (restore UI state) -----
  // Restore saved room/user on first load. Do NOT emit here to avoid double-emit;
  // the socket effect below emits join when `joined` and `room` are set.
  useEffect(() => {
    const storedRoom = localStorage.getItem("codesync_room");
    const storedUser = localStorage.getItem("codesync_user");
    if (!storedRoom || !storedUser) return;
    setRoom(storedRoom);
    setDisplayName(storedUser);
    setJoined(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- Socket hooks --------
  useEffect(() => {
    if (!joined || !room) return;

    const safeUser =
      displayName || username?.trim() || `Guest${Math.floor(Math.random() * 1000)}`;

    // Emit join once here — central place for emitting join
    try {
      socket.emit("join_room", { room, user: safeUser });
    } catch (e) {
      console.warn("socket.join emit failed", e);
    }

    const onInitFiles = (data) => {
      const f = data?.files || {};
      setFiles(f);
      const first = Object.keys(f)[0] || "main.js";
      setActiveFile((prev) => (f[prev] ? prev : first));
    };

    const onInitCode = (data) => {
      const code = data?.code ?? "";
      setFiles({ "main.js": { code } });
      setActiveFile("main.js");
    };

    const onUpdate = (data) => {
      const file = data?.file;
      const code = data?.code ?? "";
      if (!file) return;
      setFiles((prev) => ({ ...prev, [file]: { code } }));
    };

    const onParticipants = (data) => setParticipants(data?.participants ?? []);

    const onSystemMessage = (data) =>
      data?.msg && pushToast(data.msg);

    const onFileCreated = (data) => {
      const filename = data?.filename;
      if (!filename) return;
      setFiles((prev) => {
        if (prev[filename]) return prev;
        return { ...prev, [filename]: { code: "" } };
      });
      setActiveFile(filename);
    };

    const onFileDeleted = (data) => {
      const filename = data?.filename;
      if (!filename) return;
      setFiles((prev) => {
        const updated = { ...prev };
        delete updated[filename];
        return updated;
      });
      setActiveFile((prev) => {
        if (prev === filename) {
          const names = Object.keys(files).filter((n) => n !== filename);
          return names[0] || "main.js";
        }
        return prev;
      });
    };

    const onFileRenamed = (data) => {
      const oldN = data?.old;
      const newN = data?.new;
      if (!oldN || !newN) return;
      setFiles((prev) => {
        if (!prev[oldN]) return prev;
        const updated = { ...prev };
        updated[newN] = updated[oldN];
        delete updated[oldN];
        return updated;
      });
      setActiveFile((prev) => (prev === oldN ? newN : prev));
    };

    const onChat = (msg) => {
      // server will broadcast messages to other clients only (server emits include_self=False)
      // so here we just append received messages from OTHER participants
      if (!msg) return;
      setChatMessages((prev) => [...prev, msg]);
      const sender = msg?.user || "Unknown";
      const text = msg?.message || "";
      if (!chatOpen && sender !== (displayName || username) && text.trim()) {
        const preview = text.length > 60 ? text.slice(0, 57) + "..." : text;
        pushToast(`${sender}: ${preview}`);
      }
    };

    socket.on("init_files", onInitFiles);
    socket.on("init_code", onInitCode);
    socket.on("code_update", onUpdate);
    socket.on("participants_update", onParticipants);
    socket.on("system_message", onSystemMessage);
    socket.on("file_created", onFileCreated);
    socket.on("file_deleted", onFileDeleted);
    socket.on("file_renamed", onFileRenamed);
    socket.on("chat_message", onChat);

    // BEFORE UNLOAD: try socket emit then sendBeacon fallback
    const beforeUnload = () => {
      try {
        if (socket && socket.connected) {
          socket.emit("leave_room", { room, user: safeUser });
        }
      } catch (e) { /* ignore */ }

      try {
        const payload = JSON.stringify({ room, user: safeUser });
        const url = API_BASE + "/leave_room";
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } catch (e) { /* ignore */ }
    };

    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      // cleanup socket listeners
      socket.off("init_files", onInitFiles);
      socket.off("init_code", onInitCode);
      socket.off("code_update", onUpdate);
      socket.off("participants_update", onParticipants);
      socket.off("system_message", onSystemMessage);
      socket.off("file_created", onFileCreated);
      socket.off("file_deleted", onFileDeleted);
      socket.off("file_renamed", onFileRenamed);
      socket.off("chat_message", onChat);

      // cleanup beforeunload
      window.removeEventListener("beforeunload", beforeUnload);

      // best-effort notify server on component unmount
      try {
        socket.emit("leave_room", { room, user: safeUser });
      } catch (e) { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, room, displayName, username, chatOpen]);

  // ----- Code change -----
  const handleCodeChange = (newCode) => {
    if (!activeFile) return;
    setFiles((prev) => ({ ...prev, [activeFile]: { code: newCode } }));
    if (room) try { socket.emit("code_change", { room, file: activeFile, code: newCode }); } catch (e) {}
  };

  // ----- Run code (Judge0) -----
  const runCode = async () => {
    if (!activeFile) return;
    setLoading(true);
    try {
      const res = await fetch(API_BASE + "/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: files[activeFile]?.code || "",
          language_id: language,
        }),
      });
      const result = await res.json().catch(() => ({}));
      setOutput(
        result.stdout ||
          result.stderr ||
          result.compile_output ||
          result.error ||
          "No output"
      );
    } catch (e) {
      setOutput("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  // ----- Room ops -----
  const createRoom = async () => {
    const safe = username?.trim() || `Guest${Math.floor(Math.random() * 1000)}`;
    try {
      const res = await fetch(API_BASE + "/create_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data?.error || data?.message || `Server ${res.status}`;
        pushToast("Error creating room: " + err);
        console.error("create_room failed", res.status, data);
        return;
      }
      if (!data.room_id) {
        pushToast("Error creating room (no room_id). Check backend logs.");
        console.error("create_room missing room_id", data);
        return;
      }
      setDisplayName(safe);
      setRoom(data.room_id);
      setJoined(true);
      localStorage.setItem("codesync_room", data.room_id);
      localStorage.setItem("codesync_user", safe);
      pushToast("Room created: " + data.room_id);
      // DO NOT emit join here — socket effect will emit join when joined & room are set
    } catch (err) {
      console.error("createRoom error", err);
      pushToast("Network error creating room");
    }
  };

  const joinRoom = async () => {
    if (!room) return pushToast("Enter room id");
    const safe = username?.trim() || `Guest${Math.floor(Math.random() * 1000)}`;
    try {
      const res = await fetch(API_BASE + "/join_room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // send { room } — backend should accept this; if your backend expects 'room_id' change accordingly
        body: JSON.stringify({ room }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) {
        pushToast("Room not found!");
        console.error("join_room failed", res.status, data);
        return;
      } else {
        setDisplayName(safe);
        setRoom(data.room_id || room);
        setFiles(data.files || { "main.js": { code: "" } });
        setParticipants(data.participants || []);
        setActiveFile((prev) => {
          const names = Object.keys(data.files || {});
          return names.includes(prev) ? prev : names[0] || "main.js";
        });
        setJoined(true);
        localStorage.setItem("codesync_room", data.room_id || room);
        localStorage.setItem("codesync_user", safe);
        pushToast("Joined room");
        // socket effect will emit join
      }
    } catch (err) {
      console.error("joinRoom error", err);
      pushToast("Error joining room");
    }
  };

  const copyRoomId = () => {
    if (!room) return;
    navigator.clipboard.writeText(room);
    pushToast("Room ID copied");
  };

  const leaveRoom = () => {
    const safe = displayName || username?.trim() || "Guest";
    try {
      socket.emit("leave_room", { room, user: safe });
    } catch (e) { /* ignore */ }

    // clear persisted state so next load doesn't auto-rejoin
    try { localStorage.removeItem("codesync_room"); localStorage.removeItem("codesync_user"); } catch (e) {}

    setJoined(false);
    setRoom("");
    setFiles({ "main.js": { code: "" } });
    setActiveFile("main.js");
    setOutput("");
    setParticipants([]);
    setDisplayName("");
    setAiOpen(false);
    setChatOpen(false);
  };

  // ----- File ops -----
  const createFile = () => {
    const name = prompt("Enter file name (e.g. app.js):");
    if (!name) return;
    if (files[name]) return pushToast("File already exists");
    try { socket.emit("file_create", { room, filename: name }); } catch (e) {}
    setActiveFile(name);
  };

  const deleteFile = (filename) => {
    if (!filename) return;
    if (!window.confirm(`Delete ${filename}?`)) return;
    try { socket.emit("file_delete", { room, filename }); } catch (e) {}
  };

  const renameFile = (oldName) => {
    const newName = prompt("New file name:", oldName);
    if (!newName || newName === oldName) return;
    if (files[newName]) return pushToast("A file with that name exists");
    try { socket.emit("file_rename", { room, old: oldName, new: newName }); } catch (e) {}
  };

  // ----- AI -----
  const openAiAsk = () => {
    setAiMode("ask");
    setAiOpen(true);
    setAiResult("");
  };
  const openAiConvert = () => {
    setAiMode("convert");
    setAiOpen(true);
    setAiResult("");
  };
  const runAI = async () => {
    try {
      setAiResult("Working…");
      const body =
        aiMode === "ask"
          ? {
              code: files[activeFile]?.code || "",
              action: "ask",
              concise: aiConcise,
            }
          : {
              code: files[activeFile]?.code || "",
              action: "convert",
              target_lang: targetLang || "Python",
              concise: aiConcise,
            };
      const res = await fetch(API_BASE + "/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      setAiResult(data.result || data.error || "No response");
    } catch {
      setAiResult("Error contacting AI");
    }
  };

  // ----- Chat send helper -----
  // Append locally for immediate sender view, server will broadcast to others only
  const sendChat = (msg) => {
    const safe = displayName || username || `Guest${Math.floor(Math.random() * 1000)}`;
    if (!msg || !msg.trim()) return;
    const localMsg = { user: safe, message: msg, timestamp: new Date().toLocaleTimeString() };
    setChatMessages((prev) => [...prev, localMsg]);
    try { socket.emit("chat_message", { room, user: safe, message: msg, timestamp: localMsg.timestamp }); } catch (e) {}
  };

  // ----- Resizable editor (two-way) -----
  const splitRef = useRef(null); // container for editor+output
  const [editorHeight, setEditorHeight] = useState(400);
  const [resizing, setResizing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(400);
  const minEditor = 160;
  const minOutput = 120;

  // Output collapse state
  const [outputCollapsed, setOutputCollapsed] = useState(false);

  // initialize editorHeight based on available container height
  useEffect(() => {
    const init = () => {
      const container = splitRef.current;
      if (!container) return;
      const ch = container.clientHeight;
      // reserve ~48px for control bar + a bit padding
      const controlBar = 48;
      const defaultEditor = Math.max(Math.min(Math.floor(ch * 0.7), ch - minOutput - controlBar), minEditor);
      setEditorHeight(defaultEditor);
    };
    init();
    window.addEventListener("resize", init);
    return () => window.removeEventListener("resize", init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing) return;
      const delta = e.clientY - startY;
      const container = splitRef.current;
      if (!container) return;
      const containerHeight = container.clientHeight;
      const controlBar = 48; // px approximate height of control bar
      // When output is collapsed, we don't allow resize (handle hidden), but guard anyway
      if (outputCollapsed) return;
      // clamp so editor >= minEditor and output >= minOutput
      const maxEditor = containerHeight - minOutput - controlBar;
      const newHeight = Math.min(Math.max(startHeight + delta, minEditor), Math.max(maxEditor, minEditor));
      setEditorHeight(newHeight);
    };

    const handleMouseUp = () => setResizing(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizing, startY, startHeight, outputCollapsed]);

  // ----- Landing page -----
  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-cyan-900 via-gray-950 to-black text-white flex flex-col items-center justify-center p-6">
        <div className="text-center mb-10">
          <img 
          src="/Codesync.png" 
          alt="Logo" 
          className="w-32 h-32 mx-auto mb-6 object-contain"/>
            <h1 className="text-6xl font-extrabold mb-3 text-cyan-400">CodeSync</h1>
            <p className="text-lg text-gray-400">Real-time collaborative coding platform</p>
        </div>
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700 rounded-xl p-6 w-full max-w-md space-y-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name (optional)"
            className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Enter Room ID (if joining)"
            className="w-full p-3 rounded-lg bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <div className="flex gap-4 pt-2">
            <button
              onClick={createRoom}
              className="flex-1 px-4 py-3 bg-green-600 rounded-lg hover:bg-green-700 transition"
            >
              New Room
            </button>
            <button
              onClick={joinRoom}
              className="flex-1 px-4 py-3 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Join Room
            </button>
          </div>
        </div>
        {/* toasts */}
        <div className="fixed bottom-4 right-4 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className="bg-cyan-700/90 border border-cyan-600 text-white px-4 py-2 rounded shadow"
            >
              {t.msg}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ----- Editor page -----
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2">
            <img 
            src="Codesync.png" 
            alt="CodeSync Logo" 
            className="w-8 h-8"
            />
            <h1 className="text-3xl font-bold text-cyan-400">CodeSync</h1>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-400">Room: {room}</span>
            <button
              onClick={copyRoomId}
              className="px-2 py-1 bg-gray-700 rounded-lg hover:bg-gray-600 text-xs flex items-center gap-1"
            >
              <Copy size={14} /> Copy
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            {participants.slice(0, 5).map((p, i) => (
              <div
                key={`${p}-${i}`}
                title={p}
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs"
              >
                {p}
              </div>
            ))}
            {participants.length > 5 && (
              <div className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-full text-xs">
                +{participants.length - 5}
              </div>
            )}
          </div>
          <span className="text-xs text-gray-400">{participants.length} online</span>

          <button
            onClick={() => setChatOpen((v) => !v)}
            className="px-3 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-1"
          >
            <MessageSquare size={16} /> Chat
          </button>

          <button
            onClick={leaveRoom}
            className="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 flex items-center gap-1"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 gap-4 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className="w-60 flex flex-col bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex justify-between items-center bg-gray-800 px-3 py-2 border-b border-gray-700">
            <span className="text-sm font-semibold text-gray-200">Files</span>
            <button
              onClick={createFile}
              className="text-xs bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
            >
              New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {Object.keys(files).map((fname) => (
              <div
                key={fname}
                className={`flex justify-between items-center px-3 py-1 text-sm cursor-pointer ${
                  activeFile === fname ? "bg-gray-700 border-l-4 border-cyan-500" : "hover:bg-gray-800"
                }`}
                onClick={() => setActiveFile(fname)}
              >
                <span className="truncate">{fname}</span>
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      renameFile(fname);
                    }}
                    className="text-xs px-1 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    <Edit size={12} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFile(fname);
                    }}
                    className="text-xs px-1 bg-gray-700 rounded hover:bg-gray-600"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor + Output Split with draggable handle */}
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div
            ref={splitRef}
            className="flex flex-col flex-1 min-h-0 rounded-xl overflow-hidden border border-gray-700 bg-gray-800/40 relative"
            style={{ userSelect: "none" }}
          >
            {/* Editor area (when output collapsed: fill; else: fixed resizable height with internal scroll) */}
            <div
              className={
                "rounded-xl border border-gray-700 bg-gray-800/40 editor-scrollbar " +
                (outputCollapsed ? "flex-1 overflow-auto min-h-0" : "overflow-auto")
              }
              style={
                outputCollapsed
                  ? { flex: "1 1 0%", minHeight: "150px" }
                  : { height: `${editorHeight}px`, minHeight: "150px", flexShrink: 0 }
              }
            >
              <CodeEditor
                code={files[activeFile]?.code || ""}
                onChange={handleCodeChange}
                language={language}
                filename={activeFile}
              />
            </div>

            {/* Control bar (between editor and output) */}
            <div className="flex items-center gap-2 p-2 bg-gray-900 border-t border-gray-700">
              <select
                value={language}
                onChange={(e) => setLanguage(Number(e.target.value))}
                className="bg-gray-800 text-white p-2 rounded-lg"
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>

              <button
                onClick={runCode}
                className="flex items-center gap-1 px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
              >
                <Play size={16} /> Run
              </button>

              <button
                onClick={openAiAsk}
                className="flex items-center gap-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                <Cpu size={16} /> Ask AI
              </button>

              <button
                onClick={openAiConvert}
                className="flex items-center gap-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg"
              >
                <Cpu size={16} /> Convert
              </button>

              {/* spacer */}
              <div className="flex-1" />

              {/* output controls: collapse toggle */}
              <button
                onClick={() => setOutputCollapsed((v) => !v)}
                className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
                title={outputCollapsed ? "Expand Output" : "Collapse Output"}
              >
                {outputCollapsed ? "Expand Output" : "Collapse Output"}
              </button>
            </div>

            {/* Resize Handle (hidden when collapsed) */}
            {!outputCollapsed && (
              <div
                onMouseDown={(e) => {
                  setResizing(true);
                  setStartY(e.clientY);
                  setStartHeight(editorHeight);
                }}
                className="h-2 bg-gray-700 hover:bg-cyan-400/70 cursor-row-resize transition-colors"
              />
            )}

            {/* Output Section */}
            {!outputCollapsed && (
              <div
                className="bg-gray-900 border-t border-gray-700 p-3 flex flex-col text-sm overflow-auto output-scrollbar transition-all duration-150"
                style={{
                  flex: "1 1 0%",
                  minHeight: `${minOutput}px`,
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-cyan-400 font-semibold">Output</h3>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(output || "");
                        pushToast("Output copied");
                      }}
                      className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
                      title="Copy Output"
                    >
                      Copy
                    </button>

                    <button
                      onClick={() => {
                        setOutput("");
                        pushToast("Output cleared");
                      }}
                      className="px-2 py-1 bg-red-600 rounded hover:bg-red-700 text-sm"
                      title="Clear Output"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {loading ? (
                  <div className="text-gray-400 italic">Running code...</div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-gray-200">{output || "No output yet"}</pre>
                )}
              </div>
            )}
          </div>

          {/* small spacer to keep layout neat */}
          <div className="h-1" />
        </div>
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <div
          className={`fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4 ${
            aiFullscreen ? "items-stretch" : ""
          }`}
        >
          <div
            className={`bg-gray-800 rounded-xl p-4 w-full max-w-2xl flex flex-col gap-3 relative transition-all ${
              aiFullscreen ? "h-full max-w-none rounded-none" : "max-h-[80vh]"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-cyan-400">
                {aiMode === "ask" ? "Ask AI" : "Convert Code"}
              </h2>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={aiConcise}
                    onChange={(e) => setAiConcise(e.target.checked)}
                    className="accent-cyan-400"
                  />
                  Concise
                </label>

                <button
                  onClick={() => setAiFullscreen((v) => !v)}
                  className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
                >
                  {aiFullscreen ? "Window" : "Expand"}
                </button>

                <button
                  onClick={() => setAiOpen(false)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                >
                  Close
                </button>
              </div>
            </div>

            {aiMode === "convert" && (
              <div className="flex items-center gap-3">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="bg-gray-700 p-2 rounded text-white"
                >
                  <option>Python</option>
                  <option>JavaScript</option>
                  <option>Java</option>
                  <option>C++</option>
                </select>
                <span className="text-sm text-gray-400">Target language</span>
              </div>
            )}

            <textarea
              value={aiResult}
              onChange={(e) => setAiResult(e.target.value)}
              className="w-full h-60 bg-gray-900 text-white rounded p-3 font-mono resize-y"
              placeholder={
                aiMode === "ask"
                  ? "Ask a focused question (e.g. 'Why is my code failing?')"
                  : "Converted code will appear here."
              }
            />

            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiResult || "");
                  pushToast("Copied AI result");
                }}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              >
                Copy
              </button>
              <button
                onClick={runAI}
                className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
              >
                Run AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      <ChatBox
        socket={socket}
        room={room}
        user={displayName || username || "Guest"}
        messages={chatMessages}
        open={chatOpen}
        onSend={(msg) => sendChat(msg)}
        onClose={() => setChatOpen(false)}
      />

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-cyan-700/90 border border-cyan-600 text-white px-4 py-2 rounded shadow"
          >
            {t.msg}
          </div>
        ))}
      </div>

      {/* Styled scrollbars for Output + Editor + CodeMirror height enforcement */}
      <style>{`
      /* Shared scrollbar theme for CodeEditor + Output */
      .editor-scrollbar ::-webkit-scrollbar,
      .output-scrollbar ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .editor-scrollbar ::-webkit-scrollbar-thumb,
      .output-scrollbar ::-webkit-scrollbar-thumb {
        background: rgba(100, 116, 139, 0.5);
        border-radius: 10px;
        transition: background 0.2s ease;
      }
      .editor-scrollbar ::-webkit-scrollbar-thumb:hover,
      .output-scrollbar ::-webkit-scrollbar-thumb:hover {
        background: rgba(56, 189, 248, 0.7); /* cyan glow */
      }
      .editor-scrollbar ::-webkit-scrollbar-track,
      .output-scrollbar ::-webkit-scrollbar-track {
        background: transparent;
      }

      /* Force CodeMirror editor area to respect parent's height so it scrolls internally */
      .cm-editor, .cm-scroller {
        height: 100% !important;
        min-height: 0 !important;
      }
      `}</style>
    </div>
  );
}

export default App;
