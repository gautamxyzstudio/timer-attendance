const { app, BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

let mainWindow;
let popupWindow;

const VITE_URL = "http://localhost:5173";

app.disableHardwareAcceleration();

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

  mainWindow.loadURL(VITE_URL);

  mainWindow.webContents.on("did-fail-load", () => {
    setTimeout(() => mainWindow.loadURL(VITE_URL), 1000);
  });

  mainWindow.webContents.openDevTools({ mode: "detach" });
}

/* ================= POPUP ================= */

function createPopup() {
  if (popupWindow) return;

  const { width } = screen.getPrimaryDisplay().workAreaSize;

  popupWindow = new BrowserWindow({
    width: 380,
    height: 220,
    x: width - 400,
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

  popupWindow.loadURL(`${VITE_URL}/#/popup`);

  popupWindow.on("closed", () => {
    popupWindow = null;
  });
}

/* ================= IPC ================= */

// Renderer tells Electron: user inactive + task running
ipcMain.on("show-idle-popup", () => {
  createPopup();
});

ipcMain.on("popup-response", (_, res) => {
  if (res === "no") {
    mainWindow.webContents.send("force-stop-tasks");
  }
  popupWindow?.close();
});

/* ================= LIFECYCLE ================= */

app.whenReady().then(createMainWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
