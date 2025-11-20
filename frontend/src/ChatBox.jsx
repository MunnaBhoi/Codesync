// src/ChatBox.jsx
import { useRef, useEffect, useState } from "react";
import { X } from "lucide-react";

export default function ChatBox({ socket, room, user, messages, onSend, onClose, open }) {
  const inputRef = useRef();
  const messagesEndRef = useRef();

  // resizing state (simple drag-resize)
  const [width, setWidth] = useState(380);
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const send = () => {
    const text = inputRef.current?.value || "";
    if (!text.trim()) return;
    onSend(text.trim());
    if (inputRef.current) inputRef.current.value = "";
  };

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mouse handlers for resize
  useEffect(() => {
    const onMouseMove = (e) => {
      if (!resizingRef.current) return;
      const dx = startXRef.current - e.clientX;
      const newWidth = Math.max(260, Math.min(720, startWidthRef.current + dx));
      setWidth(newWidth);
    };
    const onUp = () => {
      resizingRef.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed top-16 right-4 z-40 flex flex-col bg-gray-800/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl overflow-hidden transition-transform"
      style={{ width }}
      role="complementary"
      aria-label="Room chat"
    >
      {/* drag handle */}
      <div
        onMouseDown={(e) => {
          resizingRef.current = true;
          startXRef.current = e.clientX;
          startWidthRef.current = width;
        }}
        className="absolute left-[-8px] top-0 bottom-0 w-2 cursor-ew-resize z-50"
        aria-hidden
      />

      {/* Header */}
      <div className="px-4 py-3 bg-gray-900/90 border-b border-gray-700 text-gray-100 text-sm font-semibold flex justify-between items-center">
        <span>Room Chat</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">#{room}</span>
          <button
            onClick={() => onClose && onClose()}
            className="text-gray-400 hover:text-red-400 transition"
            aria-label="Close chat"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto max-h-[60vh]">
        {messages?.length === 0 && (
          <div className="text-xs text-gray-500 italic">No messages yet...</div>
        )}
        {messages?.map((m, i) => (
          <div
            key={i}
            className={`p-2 rounded-xl text-sm break-words max-w-full ${
              m.user === user
                ? "bg-blue-600/30 text-blue-100 self-end ml-auto"
                : "bg-gray-700/60 text-gray-200 self-start"
            } transition-all duration-150`}
          >
            <div className="text-xs text-gray-400 mb-1 flex justify-between">
              <span className="font-medium text-gray-300">{m.user}</span>
              <span>[{m.timestamp}]</span>
            </div>
            <div>{m.message}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex border-t border-gray-700 p-2 gap-2 bg-gray-900/70 rounded-b-2xl">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          className="flex-1 bg-gray-800/60 text-gray-100 px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 placeholder-gray-400 transition"
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button
          onClick={send}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:scale-105 transform transition"
        >
          Send
        </button>
      </div>
    </div>
  );
}
