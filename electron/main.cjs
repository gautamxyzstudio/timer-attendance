const {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  screen
} = require("electron");

const path = require("path");
const { autoUpdater } = require("electron-updater");


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
autoUpdater.autoDownload = false;
let mainWindow = null;
let popupWindow = null;
let idleCounterWindow = null;

let TASK_RUNNING = false;
let POPUP_OPEN = false;

/* ================= IDLE CONFIG ================= */

const IDLE_LIMIT = 300; // 5 min
const RANDOM_IDLE_MIN = 120;
const RANDOM_IDLE_MAX = 300;

const POPUP1_TIMEOUT = 60_000;
const POPUP_COOLDOWN = 15_000;

let LAST_POPUP_AT = 0;
let POPUP1_TIMER = null;
let RANDOM_IDLE_TRIGGER = null;
let LAST_IDLE = 0;

// 🔴 used only for restart / shutdown (non-breaking)
function stopTasksOnExit(reason) {
  if (!TASK_RUNNING) return;

  console.log("🛑 Stopping tasks due to:", reason);
  TASK_RUNNING = false;

  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send("force-stop-tasks");
    } catch { }
  }
}


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
    Math.floor(Math.random() * (RANDOM_IDLE_MAX - RANDOM_IDLE_MIN + 1)) +
    RANDOM_IDLE_MIN
  );
}

/* ================= POPUP 1 ================= */

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

/* ================= POPUP 2 ================= */

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
    idleCounterWindow?.destroy();
    idleCounterWindow = null;
    LAST_POPUP_AT = Date.now();
  }
});

/* ================= AUTO UPDATE ================= */

ipcMain.on("check-for-updates", () => {
  if (isDev) return;
  autoUpdater.checkForUpdates();
});


ipcMain.on("download-update", () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on("install-update", () => {
  if (isDev) return;
  autoUpdater.quitAndInstall();
});


/* ================= IDLE MONITOR ================= */

app.whenReady().then(() => {
  createMainWindow();

  // 🔒 LOCK / LOGOUT → HARD STOP ONLY (NO POPUPS)
  powerMonitor.on("lock-screen", () => {
    if (!TASK_RUNNING) return;
    TASK_RUNNING = false;
    mainWindow.webContents.send("force-stop-tasks");
  });

  powerMonitor.on("screen-locked", () => {
    if (!TASK_RUNNING) return;
    TASK_RUNNING = false;
    mainWindow.webContents.send("force-stop-tasks");
  });

  // 💤 SLEEP → Popup-1 → Popup-2
  powerMonitor.on("suspend", () => {
    if (!TASK_RUNNING) return;
    openIdleCheckPopup();
  });

  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime();

    // 🌑 Screen off / Screensaver → Popup-1 → Popup-2
    if (idle - LAST_IDLE > 30 && TASK_RUNNING && !POPUP_OPEN) {
      openIdleCheckPopup();
      LAST_IDLE = idle;
      return;
    }

    LAST_IDLE = idle;

    // user active
    if (idle < 2) {
      RANDOM_IDLE_TRIGGER = null;
      return;
    }

    // random idle (2–5 min)
    if (!RANDOM_IDLE_TRIGGER && idle >= RANDOM_IDLE_MIN) {
      RANDOM_IDLE_TRIGGER = getRandomIdleTime();
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
      RANDOM_IDLE_TRIGGER = null;
    }
  }, 5000);

  // 🔄 Check for updates on startup (production only)
  if (!isDev) {
    autoUpdater.checkForUpdates();
  }

});

// 🔁 Windows restart / shutdown / logout
app.on("session-end", () => {
  stopTasksOnExit("windows-session-end");
});

app.on("before-quit", () => {
  stopTasksOnExit("before-quit");
});

process.on("SIGTERM", () => {
  stopTasksOnExit("sigterm");
});

process.on("SIGINT", () => {
  stopTasksOnExit("sigint");
});

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/* ================= AUTO UPDATE EVENTS ================= */
autoUpdater.on("checking-for-update", () => {
  sendToRenderer("update-checking");
});

autoUpdater.on("update-available", () => {
  sendToRenderer("update-available");
});

autoUpdater.on("update-not-available", () => {
  sendToRenderer("update-not-available");
});

autoUpdater.on("download-progress", (progress) => {
  sendToRenderer("update-progress", Math.round(progress.percent));
});

autoUpdater.on("update-downloaded", () => {
  sendToRenderer("update-downloaded");
});

autoUpdater.on("error", (err) => {
  sendToRenderer("update-error", err?.message);
});


/* ================= EXIT ================= */

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

