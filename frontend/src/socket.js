// src/socket.js
import { io } from "socket.io-client";
import { API_BASE } from "./config";

/**
 * Initialize socket using the full API_BASE so production uses wss:// automatically.
 * Adjust `path` only if your backend uses a custom socket path.
 */
const socket = io(API_BASE, {
  path: "/socket.io",
  transports: ["websocket"],
  autoConnect: true,
});

export default socket;
