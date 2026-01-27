const {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor
} = require("electron");
const path = require("path");

app.disableHardwareAcceleration(); 

let mainWindow = null;
let popupWindow = null;
let popupTimer = null;

let TASK_RUNNING = false;
let POPUP_OPEN = false;

const IDLE_LIMIT = 6; // seconds

/* ================= MAIN WINDOW ================= */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL("http://localhost:5173");
  mainWindow.webContents.openDevTools({ mode: "detach" });
}

/* ================= POPUP WINDOW ================= */

function createPopup() {
  if (POPUP_OPEN) return;

  console.log("🪟 Opening idle popup");
  POPUP_OPEN = true;

  popupWindow = new BrowserWindow({
    frame: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent:true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });

  // ✅ LOAD HTML
  popupWindow.loadFile(path.join(__dirname, "popup.html"));

  // 🔥 ADD THIS BLOCK (RIGHT HERE)
  popupWindow.webContents.on("did-finish-load", () => {
    const [w, h] = popupWindow.getContentSize();
    popupWindow.setSize(w, h);
  });

  // ✅ SHOW WINDOW
  popupWindow.once("ready-to-show", () => {
    popupWindow.show();
  });

  popupWindow.on("closed", closePopup);

  // ⏱ Auto stop after 60s
  popupTimer = setTimeout(() => {
    console.log("⏱ Timeout → force stop tasks");
    mainWindow.webContents.send("force-stop-tasks");
    closePopup();
  }, 60000);

  popupWindow.webContents.openDevTools({ mode: "detach" });
}


function closePopup() {
  console.log("🧹 Closing popup");

  if (popupTimer) {
    clearTimeout(popupTimer);
    popupTimer = null;
  }

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy();
  }

  popupWindow = null;
  POPUP_OPEN = false;
}

/* ================= IPC ================= */

ipcMain.on("task-running", (_, running) => {
  TASK_RUNNING = running;
  console.log("🔥 TASK_RUNNING =", TASK_RUNNING);
});

ipcMain.on("popup-response", (_, res) => {
  console.log("🟢 Popup response:", res);

  if (res === "no" || res === "timeout") {
    console.log("🛑 Force stopping tasks NOW");
    mainWindow.webContents.send("force-stop-tasks");
  }

  closePopup();
});

/* ================= IDLE MONITOR ================= */

app.whenReady().then(() => {
  createMainWindow();

  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();

    console.log(
      `🕒 IDLE=${idle}s | TASK_RUNNING=${TASK_RUNNING} | POPUP_OPEN=${POPUP_OPEN}`
    );

    if (idle >= 6 && TASK_RUNNING && !POPUP_OPEN) {
      createPopup();
    }
  }, 5000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
