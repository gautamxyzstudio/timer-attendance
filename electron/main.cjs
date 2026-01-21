const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  powerMonitor
} = require("electron");
const path = require("path");

let mainWindow = null;
let popupWindow = null;
let popupTimer = null;

let TASK_RUNNING = false;
let POPUP_OPEN = false;

const IDLE_LIMIT = 300; // 5 minutes

/* ================= MAIN WINDOW ================= */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadURL("http://localhost:5173");
  mainWindow.webContents.openDevTools({ mode: "detach" });
}

/* ================= POPUP ================= */

function createPopup() {
  if (POPUP_OPEN) {
    console.log("⚠️ Popup already open, skipping");
    return;
  }

  console.log("🪟 Opening idle popup");
  POPUP_OPEN = true;

  const { width } = screen.getPrimaryDisplay().workAreaSize;

  popupWindow = new BrowserWindow({
    width: 360,
    height: 220,
    x: width - 380,
    y: 40,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  popupWindow.loadFile(path.join(__dirname, "popup.html"));

  // ⏱ AUTO STOP AFTER 60s
  popupTimer = setTimeout(() => {
    console.log("⏱ Timeout → force stop tasks");
    mainWindow.webContents.send("force-stop-tasks");
    closePopup();
  }, 60000);

  popupWindow.on("closed", () => {
    console.log("❎ Popup closed by user");
    closePopup();
  });
}

function closePopup() {
  console.log("🧹 Closing popup");

  if (popupTimer) {
    clearTimeout(popupTimer);
    popupTimer = null;
  }

  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy(); // 🔥 REQUIRED
  }

  popupWindow = null;
  POPUP_OPEN = false;
}

/* ================= IPC ================= */

// 🔥 Renderer updates task running state
ipcMain.on("task-running", (_, running) => {
  TASK_RUNNING = running;
  console.log("🔥 TASK_RUNNING =", TASK_RUNNING);
});

// Popup response buttons
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

    if (
      idle >= IDLE_LIMIT &&
      TASK_RUNNING &&
      !POPUP_OPEN
    ) {
      createPopup();
    }
  }, 5000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
