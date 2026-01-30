const {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  screen
} = require("electron");

if (process.platform === "win32") {
  app.setAppUserModelId("com.xyz.tasktracker"); 
}
const path = require("path");

/* ===== SINGLE INSTANCE ===== */
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.disableHardwareAcceleration();

/* ===== STATE ===== */
let mainWindow = null;
let popupWindow = null;        // popup-1 (green)
let idleCounterWindow = null;  // popup-2 (red)

let TASK_RUNNING = false;
let POPUP_OPEN = false;
let CURRENT_WORKLOG_ID = null;


const IDLE_LIMIT = 300;        // system idle seconds
const POPUP1_TIMEOUT = 60_000; // popup-1 auto timeout (60s)
const POPUP_COOLDOWN = 15_000;

let LAST_POPUP_AT = 0;
let POPUP1_TIMER = null;

/* ================= MAIN WINDOW ================= */

 
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 710,
    height: 530,
    resizable: false,     
    maximizable: false,     
    fullscreenable: false,
    autoHideMenuBar: true, 
     icon: path.join(__dirname, "public/logo.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });
 
  // 🔐 hard lock size (extra safety)
  mainWindow.setMinimumSize(710, 530);
  mainWindow.setMaximumSize(710, 530);
 
  mainWindow.loadURL("http://localhost:5173");
 
  // optional – remove if you don’t want devtools
  mainWindow.webContents.openDevTools({ mode: "detach" });

mainWindow.on("close", (e) => {
  if (!TASK_RUNNING) return;

  e.preventDefault(); // stop immediate exit

  console.log("🛑 App closing → asking renderer to stop tasks");

  mainWindow.webContents.send("force-stop-tasks");

  // ⏱ give renderer time to finish API call
  setTimeout(() => {
    TASK_RUNNING = false;
    mainWindow.destroy();
    app.quit();
  }, 1200); // 
});

}

/* ================= HELPERS ================= */

function centerWindow(win) {
  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const { x, y, width, height } = display.workArea;
  const bounds = win.getBounds();

  win.setPosition(
    Math.round(x + (width - bounds.width) / 2),
    Math.round(y + (height - bounds.height) / 2)
  );
}

/* ================= POPUP 1 (GREEN) ================= */

function openIdleCheckPopup() {
  if (POPUP_OPEN) return;

  POPUP_OPEN = true;

  popupWindow = new BrowserWindow({
    width: 340,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });

  popupWindow.loadFile("popup.html");

  popupWindow.once("ready-to-show", () => {
    centerWindow(popupWindow);
    popupWindow.show();
  });

  // ⏱️ AUTO TIMEOUT → CASE 3
POPUP1_TIMER = setTimeout(() => {
  if (!POPUP_OPEN) return;

  console.log("⏱️ Popup-1 timeout → FORCE stop tasks + open popup-2");

  // 🔴 CRITICAL: STOP TASKS FIRST
  TASK_RUNNING = false;
  mainWindow.webContents.send("force-stop-tasks");

  // close popup-1 (no cooldown reset)
  closePopup1(false);

  // open popup-2 (idle counter)
  openIdleCounterPopup();
}, POPUP1_TIMEOUT);


  popupWindow.on("closed", () => {
    clearTimeout(POPUP1_TIMER);
    POPUP1_TIMER = null;
    popupWindow = null;
    POPUP_OPEN = false;
    LAST_POPUP_AT = Date.now();
  });
}

function closePopup1(resetCooldown = true) {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy();
  }

  clearTimeout(POPUP1_TIMER);
  POPUP1_TIMER = null;

  popupWindow = null;
  POPUP_OPEN = false;

  if (resetCooldown) {
    LAST_POPUP_AT = Date.now();
  }
}

/* ================= POPUP 2 (RED) ================= */

function openIdleCounterPopup() {
  if (idleCounterWindow) return;

  idleCounterWindow = new BrowserWindow({
    width: 340,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });

  idleCounterWindow.loadFile("idle-check.html");

  idleCounterWindow.once("ready-to-show", () => {
    centerWindow(idleCounterWindow);
    idleCounterWindow.show();
  });

  idleCounterWindow.on("closed", () => {
    idleCounterWindow = null;
    LAST_POPUP_AT = Date.now();
  });

  // 🔴 FORCE STOP TASKS
  TASK_RUNNING = false;
  mainWindow.webContents.send("force-stop-tasks");
}

/* ================= IPC ================= */

ipcMain.on("task-running", (_, running) => {
  TASK_RUNNING = Boolean(running);
  console.log("📡 TASK_RUNNING =", TASK_RUNNING);
});

ipcMain.on("popup-response", (_, payload) => {
  const { type, action } = payload;

  console.log("🟢 Popup response:", payload);

  // 🟢 POPUP-1
  if (type === "idle-check") {
    closePopup1();

    // ✅ Case 1
    if (action === "working") return;

    // ❌ Case 2 (manual not working)
    if (action === "not-working") {
      TASK_RUNNING = false;
      mainWindow.webContents.send("force-stop-tasks");
      return;
    }
  }

  // 🔴 POPUP-2
  if (type === "idle-counter") {
    if (action === "working") {
      TASK_RUNNING = true;
      mainWindow.webContents.send("resume-tasks");
    }

    if (idleCounterWindow && !idleCounterWindow.isDestroyed()) {
      idleCounterWindow.destroy();
    }

    idleCounterWindow = null;
    LAST_POPUP_AT = Date.now();
  }
});

ipcMain.on("set-worklog-id", (_, id) => {
  CURRENT_WORKLOG_ID = id;
  console.log("📥 WorkLog ID stored:", id);
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
      !POPUP_OPEN &&
      Date.now() - LAST_POPUP_AT > POPUP_COOLDOWN
    ) {
      openIdleCheckPopup();
    }
  }, 5000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
