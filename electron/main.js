'use strict';

const { app, BrowserWindow, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = 3000;
const APP_URL = `http://localhost:${PORT}`;
const IS_DEV = process.env.NODE_ENV === 'development';
const ROOT = IS_DEV ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app');

let mainWindow = null;
let serverProcess = null;
let tray = null;

// ── Resolve Node.js binary ────────────────────────────────────────────────────
function findNode() {
  const candidates = [
    process.execPath.replace(/electron(\.exe)?$/, 'node$1'), // electron's bundled node
    '/usr/local/bin/node',
    '/usr/bin/node',
    '/opt/homebrew/bin/node',
  ];
  // Try PATH first
  try {
    const fromPath = execSync('which node', { encoding: 'utf8' }).trim();
    if (fromPath) candidates.unshift(fromPath);
  } catch (_) {}

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

// ── Check port availability ───────────────────────────────────────────────────
function isPortFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => { s.close(); resolve(true); });
    s.listen(port, '127.0.0.1');
  });
}

// ── Wait for server to be ready ───────────────────────────────────────────────
function waitForServer(url, timeoutMs = 60000) {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    function attempt() {
      http.get(url, (res) => {
        if (res.statusCode < 500) return resolve();
        if (Date.now() > deadline) return reject(new Error('Server timeout'));
        setTimeout(attempt, 500);
      }).on('error', () => {
        if (Date.now() > deadline) return reject(new Error('Server timeout'));
        setTimeout(attempt, 500);
      });
    }
    attempt();
  });
}

// ── .env.local check / first-run setup ───────────────────────────────────────
function ensureEnv() {
  const envPath = path.join(ROOT, '.env.local');
  const examplePath = path.join(ROOT, '.env.example');
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
    } else {
      dialog.showErrorBox(
        'Missing Configuration',
        `.env.local not found at:\n${envPath}\n\nPlease create it with your API keys before launching.`
      );
      app.quit();
      return false;
    }
  }
  return true;
}

// ── Start Supabase (non-blocking attempt) ─────────────────────────────────────
function tryStartSupabase() {
  try {
    execSync('supabase status', { cwd: ROOT, timeout: 5000, stdio: 'pipe' });
    console.log('[caenan] Supabase already running');
  } catch (_) {
    console.log('[caenan] Starting Supabase...');
    spawn('supabase', ['start'], {
      cwd: ROOT,
      detached: true,
      stdio: 'ignore',
    }).unref();
  }
}

// ── Start Next.js server ──────────────────────────────────────────────────────
async function startServer() {
  const alreadyUp = !(await isPortFree(PORT));
  if (alreadyUp) {
    console.log(`[caenan] Port ${PORT} already in use — skipping server start`);
    return;
  }

  const nodeExec = findNode();
  if (!nodeExec) {
    dialog.showErrorBox(
      'Node.js Not Found',
      'Caenan Local Edge requires Node.js to be installed.\n\nhttps://nodejs.org'
    );
    app.quit();
    return;
  }

  // Prefer standalone build, fall back to next start
  const standaloneServer = path.join(ROOT, '.next', 'standalone', 'server.js');
  let cmd, args, cwd, env;

  if (fs.existsSync(standaloneServer)) {
    cmd = nodeExec;
    args = [standaloneServer];
    cwd = path.join(ROOT, '.next', 'standalone');
    env = {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
    };
  } else {
    // Development / unbuilt — run next dev or next start
    const nextBin = path.join(ROOT, 'node_modules', '.bin', 'next');
    const built = fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'));
    cmd = nodeExec;
    args = [nextBin, built ? 'start' : 'dev', '--port', String(PORT)];
    cwd = ROOT;
    env = { ...process.env, NODE_ENV: built ? 'production' : 'development' };
  }

  console.log(`[caenan] Starting server: ${cmd} ${args.join(' ')}`);
  serverProcess = spawn(cmd, args, { cwd, env, stdio: 'pipe' });
  serverProcess.stdout?.on('data', (d) => process.stdout.write(d));
  serverProcess.stderr?.on('data', (d) => process.stderr.write(d));
  serverProcess.on('exit', (code) => {
    console.log(`[caenan] Server exited (${code})`);
  });
}

// ── Create the main window ────────────────────────────────────────────────────
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

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Tray icon ─────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16 }));
  tray.setToolTip('Caenan Local Edge');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Caenan', click: () => mainWindow ? mainWindow.show() : createWindow() },
    { label: 'Open Supabase Studio', click: () => shell.openExternal('http://127.0.0.1:54323') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('double-click', () => mainWindow?.show());
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  if (!ensureEnv()) return;

  tryStartSupabase();
  await startServer();

  try {
    await waitForServer(APP_URL);
  } catch (err) {
    dialog.showErrorBox('Startup Failed', `Server did not respond at ${APP_URL}.\n\n${err.message}`);
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
  // Keep alive in tray on macOS
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});
