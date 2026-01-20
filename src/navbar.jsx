export default function Nav({ onHome, onLogout }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-slate-900 text-white shadow-md">
      <div className="h-full flex items-center justify-between px-6">
        
        {/* LEFT: Home + App name */}
        <div className="flex items-center gap-4">
          <button
            onClick={onHome}
            className="flex items-center text-black gap-1 px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-sm"
          >
            🏠 Home
          </button>

          <span className="text-lg font-semibold text-blue-400">
            TaskTimer
          </span>
        </div>

        {/* RIGHT: Logout */}
        <button
          onClick={onLogout}
          className="px-3 py-1 rounded-md text-black hover:bg-red-700 text-sm"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
