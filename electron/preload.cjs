const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  showIdlePopup: () =>
    ipcRenderer.send("show-idle-popup"),

  onForceStopTasks: (cb) =>
    ipcRenderer.on("force-stop-tasks", cb),

  popupResponse: (res) =>
    ipcRenderer.send("popup-response", res)
});
