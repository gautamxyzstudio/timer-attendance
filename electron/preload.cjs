const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  /* ================= POPUP COMMUNICATION ================= */

  /**
   * Used by:
   * - popup.html (green)  → "yes"
   * - idle-counter.html (red) → { result: "working", idleSeconds }
   */
  popupResponse: (res) => {
    ipcRenderer.send("popup-response", res);
  },

  /* ================= TASK CONTROL ================= */

  /**
   * Renderer → Main
   * Inform whether a task is running
   */
  setTaskRunning: (running) => {
    ipcRenderer.send("task-running", running);
  },

  /**
   * Main → Renderer
   * Force stop tasks when user is idle
   */
  onForceStopTasks: (callback) => {
    ipcRenderer.removeAllListeners("force-stop-tasks");
    ipcRenderer.on("force-stop-tasks", callback);
  }
});
