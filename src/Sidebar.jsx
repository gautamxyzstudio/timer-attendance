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


import { useEffect, useState } from "react";
import { Settings } from "lucide-react";

export default function Sidebar({ activeFilter, setActiveFilter }) {
  const [showMenu, setShowMenu] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    const checking = () => setUpdateStatus("Checking…");
    const available = () => setUpdateStatus("Update available");
    const notAvailable = () => setUpdateStatus("Up to date");
    const downloaded = () => {
      setUpdateStatus("Restart required");
      setUpdateReady(true);
    };
    const error = () => setUpdateStatus("Update failed");

    window.electronAPI.onUpdateChecking(checking);
    window.electronAPI.onUpdateAvailable(available);
    window.electronAPI.onUpdateNotAvailable(notAvailable);
    window.electronAPI.onUpdateDownloaded(downloaded);
    window.electronAPI.onUpdateError(error);

    return () => {
      window.electronAPI.removeUpdateChecking(checking);
      window.electronAPI.removeUpdateAvailable(available);
      window.electronAPI.removeUpdateNotAvailable(notAvailable);
      window.electronAPI.removeUpdateDownloaded(downloaded);
      window.electronAPI.removeUpdateError(error);
    };
  }, []);

  const handleCheckUpdates = () => {
    if (updateReady) {
      window.electronAPI.installUpdate();
    } else {
      setUpdateStatus("Checking…");
      window.electronAPI.checkForUpdates();
    }
  };

  return (
    <div className="flex justify-center" style={{ width: 121 }}>
      <div className="bg-white rounded-2xl p-4 w-full shadow-sm flex flex-col h-[324px]">

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

        {/* ===== FOOTER ===== */}
        <div className="mt-auto pb-2 relative flex justify-center">

          {/* SETTINGS BUTTON */}
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="relative w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <Settings size={20} className="text-gray-700" />

            {/* UPDATE DOT */}
            {updateStatus === "Update available" && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-blue-500 rounded-full" />
            )}
          </button>

          {/* DROPDOWN */}
          {showMenu && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white border shadow-lg rounded-lg w-40 text-xs z-50">
              <button
                onClick={handleCheckUpdates}
                className="w-full px-3 py-2 text-left hover:bg-gray-100 rounded-t-lg"
              >
                {updateReady ? "Restart to Update" : "Check for updates"}
              </button>

              {updateStatus && (
                <div className="px-3 py-1 text-[11px] text-gray-500 border-t text-center">
                  {updateStatus}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
