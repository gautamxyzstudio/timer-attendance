const {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  screen
} = require("electron");

const path = require("path");

/* ================= APP NAME & WINDOWS ID ================= */

app.setName("Time Tracker");

if (process.platform === "win32") {
  app.setAppUserModelId("com.xyz.timetracker");
}

/* ================= SINGLE INSTANCE ================= */

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.disableHardwareAcceleration();

/* ================= ENV ================= */

const isDev = !app.isPackaged;

/* ================= STATE ================= */

let mainWindow = null;
let popupWindow = null;
let idleCounterWindow = null;

let TASK_RUNNING = false;
let POPUP_OPEN = false;
let CURRENT_WORKLOG_ID = null;

/* ================= IDLE CONFIG ================= */

// max idle = 5 min
const IDLE_LIMIT = 300;

// random popup window = 2–5 min
const RANDOM_IDLE_MIN = 120;
const RANDOM_IDLE_MAX = 300;

const POPUP1_TIMEOUT = 60_000;
const POPUP_COOLDOWN = 15_000;

let LAST_POPUP_AT = 0;
let POPUP1_TIMER = null;

// random idle state
let RANDOM_IDLE_TRIGGER = null;

/* ================= MAIN WINDOW ================= */

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 710,
    height: 530,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: "Time Tracker",

    icon: path.join(__dirname, "../assets/icons/icon.png"),

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });

  mainWindow.setMinimumSize(710, 530);
  mainWindow.setMaximumSize(710, 530);

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("close", (e) => {
    if (!TASK_RUNNING) return;

    e.preventDefault();

    console.log("🛑 App closing → asking renderer to stop tasks");
    mainWindow.webContents.send("force-stop-tasks");

    setTimeout(() => {
      TASK_RUNNING = false;
      mainWindow.destroy();
      app.quit();
    }, 1200);
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

function getRandomIdleTime() {
  return (
    Math.floor(
      Math.random() * (RANDOM_IDLE_MAX - RANDOM_IDLE_MIN + 1)
    ) + RANDOM_IDLE_MIN
  );
}

/* ================= POPUP 1 (IDLE CHECK) ================= */

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

    icon: path.join(__dirname, "../assets/icons/icon.png"),

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });

  popupWindow.loadFile(path.join(__dirname, "popup.html"));

  popupWindow.once("ready-to-show", () => {
    centerWindow(popupWindow);
    popupWindow.show();
  });

  POPUP1_TIMER = setTimeout(() => {
    if (!POPUP_OPEN) return;

    TASK_RUNNING = false;
    mainWindow.webContents.send("force-stop-tasks");

    closePopup1(false);
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

  if (resetCooldown) LAST_POPUP_AT = Date.now();
}

/* ================= POPUP 2 (IDLE COUNTER) ================= */

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

    icon: path.join(__dirname, "../assets/icons/icon.png"),

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true
    }
  });

  idleCounterWindow.loadFile(path.join(__dirname, "idle-check.html"));

  idleCounterWindow.once("ready-to-show", () => {
    centerWindow(idleCounterWindow);
    idleCounterWindow.show();
  });

  idleCounterWindow.on("closed", () => {
    idleCounterWindow = null;
    LAST_POPUP_AT = Date.now();
  });

  TASK_RUNNING = false;
  mainWindow.webContents.send("force-stop-tasks");
}

/* ================= IPC ================= */

ipcMain.on("task-running", (_, running) => {
  TASK_RUNNING = Boolean(running);
});

ipcMain.on("popup-response", (_, payload) => {
  const { type, action } = payload;

  if (type === "idle-check") {
    closePopup1();

    if (action === "not-working") {
      TASK_RUNNING = false;
      mainWindow.webContents.send("force-stop-tasks");
    }
  }

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
});

/* ================= IDLE MONITOR ================= */

app.whenReady().then(() => {
  createMainWindow();

  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();

    console.log(
      `🕒 IDLE=${idle}s | TASK_RUNNING=${TASK_RUNNING} | POPUP_OPEN=${POPUP_OPEN}`
    );

    // user active again → reset random timer
    if (idle < 2) {
      RANDOM_IDLE_TRIGGER = null;
      return;
    }

    // generate random trigger once per idle session
    if (!RANDOM_IDLE_TRIGGER && idle >= RANDOM_IDLE_MIN) {
      RANDOM_IDLE_TRIGGER = getRandomIdleTime();
      console.log("🎯 Popup will show at:", RANDOM_IDLE_TRIGGER, "seconds");
    }

    if (
      RANDOM_IDLE_TRIGGER &&
      idle >= RANDOM_IDLE_TRIGGER &&
      idle <= IDLE_LIMIT &&
      TASK_RUNNING &&
      !POPUP_OPEN &&
      Date.now() - LAST_POPUP_AT > POPUP_COOLDOWN
    ) {
      openIdleCheckPopup();
      RANDOM_IDLE_TRIGGER = null; // prevent repeat
    }
  }, 5000);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
