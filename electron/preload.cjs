const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  popupResponse: (res) => ipcRenderer.send("popup-response", res),
  onForceStopTasks: (cb) =>
    ipcRenderer.on("force-stop-tasks", cb),

  setTaskRunning: (running) =>
    ipcRenderer.send("task-running", running)
});
