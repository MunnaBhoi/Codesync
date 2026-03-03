# CodeSync – Real-Time Collaborative Code Editor
## Overview
CodeSync is an enterprise-grade, real-time collaborative code editor that enables multiple developers to write, edit, execute, and communicate seamlessly within shared coding environments. The platform leverages WebSocket-based synchronization, comprehensive multi-language code execution, and a polished, professional developer interface.

## Key Features
- **Real-Time Collaborative Editing** – Multi-user synchronization powered by WebSocket protocol with automatic session recovery
- **Room-Based Workspace Management** – Secure room creation and joining with comprehensive user presence tracking
- **Multi-File Project Support** – Full file lifecycle management including creation, renaming, deletion, and seamless navigation
- **Integrated Communication System** – Real-time messaging infrastructure with system event notifications
- **Code Execution Engine** – Robust Judge0 API integration supporting multiple programming languages
- **Extensible AI Integration** – Pluggable backend architecture for advanced code recommendations
- **Professional User Interface** – Responsive design built with Tailwind CSS and customizable drag-resizable workspace panels

## Technology Stack
**Frontend:** React (Vite), Tailwind CSS, CodeMirror v6, Socket.IO Client  
**Backend:** Flask, Flask-SocketIO (eventlet), Redis  
**Code Execution:** Judge0 API  
**Infrastructure:** Vercel (frontend), Render (backend)

## Installation & Setup
```bash
# Backend Configuration
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py

# Frontend Configuration
cd frontend
npm install
npm run dev
```

## Getting Started
Access the frontend at `http://localhost:5173` and backend at `http://localhost:5000`. Create or join a room using a unique Room ID to begin collaboration.

## System Requirements
- Node.js 18+, Python 3.9+, Docker (optional for Redis containerization)
- Valid Judge0 API credentials and configured REDIS_URL


## License
MIT License – refer to the LICENSE file for complete terms.
