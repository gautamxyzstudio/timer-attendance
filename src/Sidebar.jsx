// export default function Sidebar({
//   activeFilter,
//   setActiveFilter,
// }) {
//   return (
//     <div
//       className="flex justify-center"
//       style={{ width: 121, height: 324 }}
//     >
//       <div className="bg-white rounded-2xl p-4 w-full shadow-sm">
//         {/* TITLE */}
//         <div className="text-xs text-gray-400 mb-3">To Do List
//            <div className="w-24 h-px bg-[#FF7300] my-2" />
//         </div>

//         {/* TODAY */}
//         {/* TODAY */}
// <button
//   onClick={() => setActiveFilter("today")}
//   className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium mb-2 ${
//     activeFilter === "today"
//       ? "bg-purple-100 text-purple-700"
//       : "text-gray-700"
//   }`}
// >
//   Today
// </button>

// {/* COMPLETED */}
// <button
//   onClick={() => setActiveFilter("completed")}
//   className={`w-full px-1 py-2 rounded-lg text-sm font-medium ${
//     activeFilter === "completed"
//       ? "bg-green-100 text-green-700"
//       : "text-gray-700"
//   }`}
// >
//   Completed
// </button>

//       </div>
//     </div>
//   );
// }


import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";

export default function Sidebar({ activeFilter, setActiveFilter }) {

  const [showSettings, setShowSettings] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("Click 'Check for Updates'");
  const [updateReady, setUpdateReady] = useState(false);

  const wrapperRef = useRef(null);

  /* ================= AUTO UPDATER LISTENER (NEW SYSTEM) ================= */

  useEffect(() => {
    if (!window.electronAPI) return;

    const handler = (payload) => {
      const { status, data } = payload;

      switch (status) {

        case "checking":
          setUpdateStatus("Checking for updates...");
          break;

        case "available":
          setUpdateStatus(`Update v${data} found ↓ Downloading`);
          break;

        case "downloading":
          setUpdateStatus(`Downloading ${data}%`);
          break;

        case "downloaded":
          setUpdateStatus("Installing update & restarting...");
          setUpdateReady(true);
          break;

        case "uptodate":
          setUpdateStatus("You are on latest version");
          break;

        case "error":
          setUpdateStatus("Cannot reach update server");
          break;

        default:
          break;
      }
    };

    // listen
    const ref = window.electronAPI.onUpdaterStatus(handler);

    // cleanup (VERY important or React duplicates events)
    return () => {
      window.electronAPI.removeUpdaterStatus(ref);
    };

  }, []);

  /* ================= CLICK OUTSIDE CLOSE ================= */

  useEffect(() => {
    const handler = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) {
        setShowSettings(false);
      }
    };

    if (showSettings) {
      document.addEventListener("mousedown", handler);
    }

    return () => document.removeEventListener("mousedown", handler);
  }, [showSettings]);

  /* ================= BUTTON ACTION ================= */

  const handleCheckUpdates = () => {
    if (!window.electronAPI) return;

    setUpdateStatus("Checking for updates...");
    window.electronAPI.checkForUpdates();
  };

  /* ================= UI ================= */

  return (
    <div
      className="flex justify-center relative"
      style={{ width: 121, minHeight: 324 }}
    >
      <div className="bg-white rounded-2xl p-4 w-full shadow-sm flex flex-col relative overflow-visible">

        {/* TITLE */}
        <div className="text-xs text-gray-400 mb-3">
          To Do List
          <div className="w-24 h-px bg-[#FF7300] my-2" />
        </div>

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
          className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium ${
            activeFilter === "completed"
              ? "bg-green-100 text-green-700"
              : "text-gray-700"
          }`}
        >
          Completed
        </button>

        {/* ================= SETTINGS FOOTER ================= */}
        <div className="mt-auto pt-4 flex justify-center" ref={wrapperRef}>

          {/* ⚙️ SETTINGS BUTTON */}
          <button
            onClick={() => setShowSettings(v => !v)}
            className="relative w-10 h-10 rounded-full mb-5 border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition"
          >
            <Settings size={20} />

            {/* BLUE DOT when update found */}
            {updateStatus.includes("found") && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
            )}
          </button>

          {/* ================= POPUP ================= */}
          {showSettings && (
            <div
              className="
                absolute
                bottom-14
                left-1/2
                -translate-x-1/2
                w-[100px]
                bg-white
                border border-gray-200
                rounded-xl
                shadow-2xl
                p-3
                z-50
              "
            >
              <button
                onClick={handleCheckUpdates}
                className="w-full bg-blue-500 text-white text-sm py-2 rounded-lg hover:bg-blue-600 transition"
              >
                Check for Updates
              </button>

              <div className="text-[11px] text-gray-500 mt-2 text-center break-words leading-tight">
                {updateStatus}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
