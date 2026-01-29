const {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  screen
} = require("electron");
const path = require("path");

/* ===== SINGLE INSTANCE LOCK ===== */
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.disableHardwareAcceleration();

/* ===== STATE ===== */
let mainWindow = null;

// popup-1 (green)
let popupWindow = null;

// popup-2 (red)
let idleCounterWindow = null;

let TASK_RUNNING = false;
let POPUP_OPEN = false;

const IDLE_LIMIT = 60; // system idle seconds
let LAST_POPUP_AT = 0;
const POPUP_COOLDOWN = 15000;
let IDLE_INTERVAL_STARTED = false;

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

/* ================= HELPERS ================= */

function centerWindow(win) {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width, height } = display.workArea;
  const bounds = win.getBounds();

  win.setPosition(
    Math.round(x + (width - bounds.width) / 2),
    Math.round(y + (height - bounds.height) / 2),
    false
  );
}

/* ================= POPUP 1 (GREEN) ================= */

function createIdleCheckPopup() {
  if (POPUP_OPEN) return;

  POPUP_OPEN = true;

  popupWindow = new BrowserWindow({
    width: 324,
    height: 269,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      devTools: false
    }
  });

  popupWindow.loadFile(path.join(__dirname, "popup.html"));

  popupWindow.once("ready-to-show", () => {
    centerWindow(popupWindow);
    popupWindow.show();
  });

  popupWindow.on("closed", () => {
    popupWindow = null;
    POPUP_OPEN = false;
    LAST_POPUP_AT = Date.now();
  });
}

function closePopup1() {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy();
  }
  popupWindow = null;
  POPUP_OPEN = false;
  LAST_POPUP_AT = Date.now();
}

/* ================= POPUP 2 (RED) ================= */

function openIdleCounterPopup() {
  if (idleCounterWindow) return;

  idleCounterWindow = new BrowserWindow({
    width: 324,
    height: 269,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      devTools: false
    }
  });

  idleCounterWindow.loadFile(
    path.join(__dirname, "idle-check.html")
  );

  idleCounterWindow.once("ready-to-show", () => {
    centerWindow(idleCounterWindow);
    idleCounterWindow.show();
  });

  idleCounterWindow.on("closed", () => {
    idleCounterWindow = null;
  });

  // ⛔ stop running task officially
  TASK_RUNNING = false;
  mainWindow.webContents.send("force-stop-tasks");
}

/* ================= IPC ================= */

ipcMain.removeAllListeners("task-running");
ipcMain.on("task-running", (_, running) => {
  TASK_RUNNING = running;
});

ipcMain.removeAllListeners("popup-response");
ipcMain.on("popup-response", (_, res) => {
  console.log("🟢 Popup response:", res);

  // popup-1 → user confirmed working
  if (res === "yes") {
    closePopup1();
    return;
  }

  // popup-1 → countdown finished
  if (res === "timeout") {
    closePopup1();
    openIdleCounterPopup();
    return;
  }

  // popup-2 → user resumed work
  if (res?.result === "working") {
    TASK_RUNNING = true;

    if (idleCounterWindow && !idleCounterWindow.isDestroyed()) {
      idleCounterWindow.destroy();
      idleCounterWindow = null;
    }
  }
});

/* ================= IDLE MONITOR ================= */

app.whenReady().then(() => {
  createMainWindow();

  if (IDLE_INTERVAL_STARTED) return;
  IDLE_INTERVAL_STARTED = true;

  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();

    console.log(
      `🕒 IDLE=${idle}s | TASK_RUNNING=${TASK_RUNNING} | POPUP_OPEN=${POPUP_OPEN}`
    );

    if (
      idle >= IDLE_LIMIT &&
      TASK_RUNNING &&
      !POPUP_OPEN &&
      Date.now() - LAST_POPUP_AT > POPUP_COOLDOWN
    ) {
      console.log("🔥 Opening idle popup");
      createIdleCheckPopup();
    }
  }, 5000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
