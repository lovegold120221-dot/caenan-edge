'use strict';

const { app, BrowserWindow, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://caenan-edge.vercel.app/';

let mainWindow = null;
let tray = null;

// ── Main window ───────────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = path.join(__dirname, '..', 'build',
    process.platform === 'win32' ? 'icon.ico'
    : process.platform === 'darwin' ? 'icon.icns'
    : 'icon.png'
  );

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Caenan Local Edge',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0a0a0a',
    show: false,
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open new-tab links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16 }));
  tray.setToolTip('Caenan Local Edge');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Caenan', click: () => mainWindow ? mainWindow.show() : createWindow() },
    { label: 'Open in Browser', click: () => shell.openExternal(APP_URL) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('double-click', () => mainWindow?.show());
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
