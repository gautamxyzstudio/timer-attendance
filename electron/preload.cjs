const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  /* ================= POPUP COMMUNICATION ================= */

  /**
   * popup.html + idle-check.html
   * Sends:
   * { type: "idle-check", action }
   * { type: "idle-counter", action, idleSeconds }
   */
  popupResponse: (payload) => {
    ipcRenderer.send("popup-response", payload);
  },

  /* ================= TASK STATE ================= */

  /**
   * Renderer → Main
   * Notify whether ANY task is running
   */
  setTaskRunning: (running) => {
    ipcRenderer.send("task-running", running);
  },

  /* ================= MAIN → RENDERER ================= */

  /**
   * Main → Renderer
   * Force stop tasks when idle confirmed
   */
  onForceStopTasks: (callback) => {
    ipcRenderer.removeAllListeners("force-stop-tasks");
    ipcRenderer.on("force-stop-tasks", callback);
  },

  /**
   * Main → Renderer
   * Resume tasks after idle popup-2 "Working"
   */
  onResumeTasks: (callback) => {
    ipcRenderer.removeAllListeners("resume-tasks");
    ipcRenderer.on("resume-tasks", callback);
  }
});
