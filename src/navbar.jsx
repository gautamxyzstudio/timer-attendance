export default function Nav({ onHome, onLogout, username }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 text-white shadow-md">
      <div className="h-full flex items-center justify-between px-6">
        
        {/* LEFT: Home + Username */}
        <div className="flex items-center gap-4">
          <button
            onClick={onHome}
            className="flex items-center gap-1 px-3 py-1 rounded-md bg-gray-400 hover:bg-slate-600 text-md"
          >
            🏠 Home
          </button>

          {/* ✅ USERNAME */}
          <span className="text-lg font-semibold text-blue-300">
            {username}
          </span>
        </div>

        {/* RIGHT: Logout */}
        <button
          onClick={onLogout}
          className="px-4 py-2 rounded-md bg-gray-400 hover:bg-red-700 text-md"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
