// src/EditorPage.jsx
import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import socket from "./socket";
import CodeEditor from "./CodeEditor";
import Output from "./Output";

function EditorPage() {
  const { roomId } = useParams();
  const [code, setCode] = useState("// Write your code here...");
  const [output, setOutput] = useState("");
  const [language, setLanguage] = useState(63);
  const [loading, setLoading] = useState(false);

  const languages = [
    { id: 63, name: "JavaScript (Node.js)" },
    { id: 71, name: "Python (3.8)" },
    { id: 62, name: "Java (OpenJDK 13)" },
    { id: 50, name: "C (GCC 9.2)" },
    { id: 54, name: "C++ (GCC 9.2)" },
  ];

  // ✅ Join socket room when page loads
  useEffect(() => {
    socket.emit("join_room", { room: roomId });

    const onInit = (data) => setCode(data?.code ?? "");
    const onUpdate = (data) => setCode(data?.code ?? "");

    socket.on("init_code", onInit);
    socket.on("code_update", onUpdate);

    return () => {
      socket.off("init_code", onInit);
      socket.off("code_update", onUpdate);
    };
  }, [roomId]);

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    socket.emit("code_change", { room: roomId, code: newCode });
  };

  const runCode = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:5000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          language_id: language,
        }),
      });

      const result = await res.json();
      setOutput(
        result.stdout ||
          result.stderr ||
          result.compile_output ||
          result.error ||
          "No output"
      );
    } catch (err) {
      setOutput("Error connecting to backend");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">⚡ CodeSync Editor</h1>
      <p className="text-gray-400 mb-4">Room ID: {roomId}</p>

      <div className="grid grid-cols-2 gap-6">
        <div className="flex flex-col">
          <select
            value={language}
            onChange={(e) => setLanguage(Number(e.target.value))}
            className="mb-4 p-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          >
            {languages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>

          <CodeEditor code={code} setCode={handleCodeChange} />

          <button
            onClick={runCode}
            disabled={loading}
            className="mt-4 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Running..." : "Run Code"}
          </button>
        </div>

        <Output output={output} />
      </div>
    </div>
  );
}

export default EditorPage;
