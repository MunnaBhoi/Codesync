// src/config.js
// Single place for API base (Vite uses VITE_ prefix in build)
export const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";
