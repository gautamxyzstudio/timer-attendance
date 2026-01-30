export default function Sidebar({
  activeFilter,
  setActiveFilter,
}) {
  return (
    <div
      className="flex justify-center"
      style={{ width: 121, height: 324 }}
    >
      <div className="bg-white rounded-2xl p-4 w-full shadow-sm">
        {/* TITLE */}
        <div className="text-xs text-gray-400 mb-3">To Do List
           <div className="w-24 h-px bg-[#FF7300] my-2" />
        </div>

        {/* TODAY */}
        {/* TODAY */}
<button
  onClick={() => setActiveFilter("today")}
  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-2 ${
    activeFilter === "today"
      ? "bg-purple-100 text-purple-700"
      : "text-gray-700"
  }`}
>
  Today
</button>

{/* COMPLETED */}
<button
  onClick={() => setActiveFilter("completed")}
  className={`w-full px-1 py-2 rounded-lg text-sm font-medium ${
    activeFilter === "completed"
      ? "bg-green-100 text-green-700"
      : "text-gray-700"
  }`}
>
  Completed
</button>

      </div>
    </div>
  );
}
