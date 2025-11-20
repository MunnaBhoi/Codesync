// src/LandingPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

function LandingPage() {
  const [room, setRoom] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    if (room.trim()) {
      navigate(`/editor/${room}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-4 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-cyan-400">CodeSync</h1>
        <div className="space-x-6">
          <a href="#" className="hover:text-cyan-400 transition">Home</a>
          <a href="#features" className="hover:text-cyan-400 transition">Features</a>
          <a href="#join" className="hover:text-cyan-400 transition">Join Room</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center flex-1 text-center px-6">
        <motion.h2
          className="text-5xl font-extrabold mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          Collaborative Coding. Reimagined.
        </motion.h2>
        <p className="text-lg text-gray-400 max-w-2xl mb-8">
          CodeSync is a real-time collaborative coding platform where you and your team
          can code together, execute in multiple languages, and stay in sync seamlessly.
        </p>
        <a
          href="#join"
          className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-xl shadow-lg transition text-lg font-medium"
        >
          Get Started
        </a>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 px-8 bg-gray-900">
        <h3 className="text-3xl font-bold text-center mb-12">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-cyan-500/20 transition">
            <h4 className="text-xl font-semibold mb-2 text-cyan-400">Real-time Collaboration</h4>
            <p className="text-gray-400">
              Edit code together seamlessly, with instant updates across all devices.
            </p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-cyan-500/20 transition">
            <h4 className="text-xl font-semibold mb-2 text-cyan-400">Multi-language Execution</h4>
            <p className="text-gray-400">
              Run programs in multiple languages using integrated Judge0 API.
            </p>
          </div>
          <div className="bg-gray-800 rounded-2xl p-6 shadow-lg hover:shadow-cyan-500/20 transition">
            <h4 className="text-xl font-semibold mb-2 text-cyan-400">Seamless Cloud Sync</h4>
            <p className="text-gray-400">
              Keep your work synced and accessible from anywhere, anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Join Room Section */}
      <section
        id="join"
        className="flex flex-col items-center justify-center py-20 bg-gray-950 text-center px-6"
      >
        <h3 className="text-3xl font-bold mb-6">Join a Room</h3>
        <p className="text-gray-400 mb-8">
          Enter your Room ID to collaborate instantly with your team.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          <input
            type="text"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="Enter Room ID"
            className="flex-1 p-3 rounded-lg bg-gray-800 border border-gray-700 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
          />
          <button
            onClick={handleJoin}
            className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 rounded-lg shadow-lg transition"
          >
            Join
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-500 border-t border-gray-800">
        © {new Date().getFullYear()} CodeSync. All rights reserved.
      </footer>
    </div>
  );
}

export default LandingPage;
