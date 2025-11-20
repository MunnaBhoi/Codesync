// src/CodeEditor.jsx
import React, { useRef, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

function CodeEditor({ code, onChange, filename, language }) {
  const editorRef = useRef(null);

  useEffect(() => {
    // Ensure parent and editor have 0 min-height so flexbox allows scrolling instead of expanding.
    const node = editorRef.current;
    if (!node) return;
    // the wrapper may be the container; set style guards
    node.style.minHeight = "0";
    node.style.height = "100%";
    node.style.display = "flex";
    node.style.flexDirection = "column";

    // make sure cm-scroller doesn't grow beyond parent
    const observer = new ResizeObserver(() => {
      const cm = node.querySelector(".cm-editor, .cm-scroller");
      if (cm) {
        cm.style.height = "100%";
        cm.style.minHeight = "0";
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Choose language extension based on filename or prop (simple heuristic)
  const getExtensions = () => {
    if (typeof filename === "string") {
      if (filename.endsWith(".py")) return [javascript({ jsx: false })]; // fallback — you can add python ext later
      if (filename.endsWith(".java")) return [javascript()]; // fallback
    }
    // default to JS for now (your setup uses language id separately)
    return [javascript()];
  };

  return (
    <div ref={editorRef} className="relative w-full flex-1 rounded-2xl overflow-hidden bg-transparent min-h-0">
      {/* Filename header */}
      <div className="bg-gray-900/70 border-b border-gray-700 px-4 py-2 text-sm text-gray-300 font-semibold flex justify-between items-center">
        <span className="truncate">{filename || "Editor"}</span>
        <div className="text-xs text-cyan-400">● Live</div>
      </div>

      {/* CodeMirror (fill parent) */}
      <div className="flex-1 min-h-0">
        <CodeMirror
          value={code || ""}
          height="100%"
          theme={oneDark}
          extensions={getExtensions()}
          onChange={(value) => onChange(value)}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: true,
            autocompletion: true,
            highlightSelectionMatches: true,
          }}
          className="h-full"
        />
      </div>
    </div>
  );
}

export default CodeEditor;
