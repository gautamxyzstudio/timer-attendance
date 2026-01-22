export default function Sidebar({
  activeFilter,
  setActiveFilter,
  todayCount,
  inProgressCount,
  completedCount,
}) {
  const baseBtn =
    "w-full flex items-center justify-between px-4 py-2 rounded-lg text-sm font-medium transition";

  return (
    <aside className="w-64 bg-gray-100 border-r border-gray-200 p-4">
      <h3 className="text-gray-700 font-semibold mb-4">
        Tasks
      </h3>

      {/* TODAY */}
      <button
        onClick={() => setActiveFilter("today")}
        className={`${baseBtn} ${
          activeFilter === "today"
            ? "bg-purple-100 text-purple-700"
            : "text-gray-600 hover:bg-gray-200"
        }`}
      >
        <span>Today</span>
        <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
          {todayCount}
        </span>
      </button>

      {/* IN PROGRESS */}
      <button
        onClick={() => setActiveFilter("in-progress")}
        className={`${baseBtn} mt-2 ${
          activeFilter === "in-progress"
            ? "bg-blue-100 text-blue-700"
            : "text-gray-600 hover:bg-gray-200"
        }`}
      >
        <span>In Progress</span>
        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
          {inProgressCount}
        </span>
      </button>

      {/* COMPLETED */}
      <button
        onClick={() => setActiveFilter("completed")}
        className={`${baseBtn} mt-2 ${
          activeFilter === "completed"
            ? "bg-green-100 text-green-700"
            : "text-gray-600 hover:bg-gray-200"
        }`}
      >
        <span>Completed</span>
        <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
          {completedCount}
        </span>
      </button>

      {/* ALL */}
      <button
        onClick={() => setActiveFilter("all")}
        className={`${baseBtn} mt-2 ${
          activeFilter === "all"
            ? "bg-gray-300 text-gray-800"
            : "text-gray-600 hover:bg-gray-200"
        }`}
      >
        All Tasks
      </button>
    </aside>
  );
}
