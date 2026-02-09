const { contextBridge, ipcRenderer } = require("electron");

// ⛔ Prevent Electron from showing "Internal Server Error" dialogs
window.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  console.error("Unhandled promise rejection:", event.reason);
});

window.addEventListener("error", (event) => {
  event.preventDefault();
  console.error("Renderer error:", event.error || event.message);
});


contextBridge.exposeInMainWorld("electronAPI", {
  /* ================= STATE SYNC ================= */
  setWorkLogId: (id) =>
    ipcRenderer.send("set-worklog-id", id),

  setTaskRunning: (running) =>
    ipcRenderer.send("task-running", running),

  popupResponse: (payload) =>
    ipcRenderer.send("popup-response", payload),

  /* ================= FORCE STOP ================= */
  onForceStopTasks: (cb) =>
    ipcRenderer.on("force-stop-tasks", cb),

  removeForceStopTasks: (cb) =>
    ipcRenderer.removeListener("force-stop-tasks", cb),

  /* ================= RESUME TASK ================= */
  onResumeTasks: (cb) =>
    ipcRenderer.on("resume-tasks", cb),

  removeResumeTasks: (cb) =>
    ipcRenderer.removeListener("resume-tasks", cb),

  /* ================= AUTO UPDATE ================= */

  onUpdaterStatus: (cb) => {
    const handler = (_, payload) => cb(payload);
    ipcRenderer.on("updater-status", handler);
    return handler; // return reference
  },

  removeUpdaterStatus: (handler) => {
    ipcRenderer.removeListener("updater-status", handler);
  },


  checkForUpdates: () =>
    ipcRenderer.send("check-for-updates"),

  downloadUpdate: () =>
    ipcRenderer.send("download-update"),

  installUpdate: () =>
    ipcRenderer.send("install-update"),


});
