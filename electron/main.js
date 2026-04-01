'use strict';

const { app, BrowserWindow, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const { fork, execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 3375;
const APP_URL = `http://localhost:${PORT}`;

let mainWindow = null;
let serverProcess = null;
let tray = null;

// ── Resolve paths ─────────────────────────────────────────────────────────────
// In packaged app, resources are at process.resourcesPath/app
const APP_ROOT = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..');

// ── Start Supabase (non-blocking) ─────────────────────────────────────────────
function tryStartSupabase() {
  try {
    execSync('supabase status', { cwd: APP_ROOT, timeout: 5000, stdio: 'pipe' });
    console.log('[caenan] Supabase already running');
  } catch (_) {
    console.log('[caenan] Starting Supabase...');
    spawn('supabase', ['start'], {
      cwd: APP_ROOT,
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
}

// ── Wait for HTTP server ──────────────────────────────────────────────────────
function waitForServer(url, timeoutMs = 60000) {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function attempt() {
      http.get(url, (res) => {
        if (res.statusCode < 500) return resolve();
        if (Date.now() > deadline) return reject(new Error('timeout'));
        setTimeout(attempt, 600);
      }).on('error', () => {
        if (Date.now() > deadline) return reject(new Error('timeout'));
        setTimeout(attempt, 600);
      });
    }
    attempt();
  });
}

// ── Start Next.js using Electron's own Node runtime ───────────────────────────
// Uses child_process.fork — inherits Electron's bundled Node, no system Node needed
function startNextServer() {
  const standaloneServer = path.join(APP_ROOT, '.next', 'standalone', 'server.js');

  if (!fs.existsSync(standaloneServer)) {
    dialog.showErrorBox(
      'Build Missing',
      `Standalone Next.js build not found at:\n${standaloneServer}\n\nRun: npm run electron:build:mac (or linux/win)`
    );
    app.quit();
    return;
  }

  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'production',
    // Point to local Supabase
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
  };

  // fork() uses Electron's built-in Node — no system Node.js required
  serverProcess = fork(standaloneServer, [], {
    cwd: path.join(APP_ROOT, '.next', 'standalone'),
    env,
    silent: true,
  });

  serverProcess.stdout?.on('data', (d) => process.stdout.write(d));
  serverProcess.stderr?.on('data', (d) => process.stderr.write(d));
  serverProcess.on('exit', (code) => console.log(`[caenan] server exited (${code})`));
}

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
    { label: 'Supabase Studio', click: () => shell.openExternal('http://127.0.0.1:54323') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('double-click', () => mainWindow?.show());
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  tryStartSupabase();
  startNextServer();

  try {
    await waitForServer(APP_URL);
  } catch (err) {
    dialog.showErrorBox('Startup Failed',
      `Local server did not start at ${APP_URL}.\n\nMake sure Docker is running for Supabase.\n\n${err.message}`);
    app.quit();
    return;
  }

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  serverProcess?.kill('SIGTERM');
  serverProcess = null;
});
