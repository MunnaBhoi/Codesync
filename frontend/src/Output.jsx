// src/Output.jsx
import React from "react";

function Output({ output }) {
  return (
    <div className="flex flex-col h-full border border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-800 px-3 py-2 border-b border-gray-700">
        <h2 className="text-sm font-semibold text-gray-200">Output</h2>
      </div>
      <div className="flex-1 p-3 bg-gray-900 text-green-400 whitespace-pre-wrap overflow-y-auto min-h-[160px]">
        {output || "—"}
      </div>
    </div>
  );
}

export default Output;
