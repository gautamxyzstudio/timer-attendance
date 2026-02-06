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
  checkForUpdates: () =>
    ipcRenderer.send("check-for-updates"),

  downloadUpdate: () =>
    ipcRenderer.send("download-update"),

  installUpdate: () =>
    ipcRenderer.send("install-update"),

  onUpdateChecking: (cb) =>
    ipcRenderer.on("update-checking", cb),

  onUpdateAvailable: (cb) =>
    ipcRenderer.on("update-available", cb),

  onUpdateNotAvailable: (cb) =>
    ipcRenderer.on("update-not-available", cb),

  onUpdateProgress: (cb) =>
    ipcRenderer.on("update-progress", cb),

  onUpdateDownloaded: (cb) =>
    ipcRenderer.on("update-downloaded", cb),

  onUpdateError: (cb) =>
    ipcRenderer.on("update-error", cb),

  removeUpdateChecking: (cb) =>
  ipcRenderer.removeListener("update-checking", cb),

removeUpdateAvailable: (cb) =>
  ipcRenderer.removeListener("update-available", cb),

removeUpdateNotAvailable: (cb) =>
  ipcRenderer.removeListener("update-not-available", cb),

removeUpdateProgress: (cb) =>
  ipcRenderer.removeListener("update-progress", cb),

removeUpdateDownloaded: (cb) =>
  ipcRenderer.removeListener("update-downloaded", cb),

removeUpdateError: (cb) =>
  ipcRenderer.removeListener("update-error", cb),

});
