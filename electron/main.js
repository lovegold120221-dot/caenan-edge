'use strict';

const {
  app, BrowserWindow, dialog, shell, Tray, Menu, nativeImage, ipcMain,
} = require('electron');
const { execSync, spawn } = require('child_process');
const path  = require('path');
const fs    = require('fs');

// ─── Constants ────────────────────────────────────────────────────────────────
const APP_URL    = 'https://echolab.eburon.ai/';
const SETUP_FLAG = path.join(app.getPath('userData'), 'setup-complete');
const APP_ROOT   = app.isPackaged
  ? path.join(process.resourcesPath, 'app')
  : path.join(__dirname, '..');

// ─── Windows ──────────────────────────────────────────────────────────────────
let mainWindow   = null;
let setupWindow  = null;
let tray         = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Build PATH that includes Homebrew (macOS) and ~/.local/bin (Linux). */
function buildEnv() {
  const env = { ...process.env };
  if (process.platform === 'darwin') {
    env.PATH = [
      '/opt/homebrew/bin', '/opt/homebrew/sbin',
      '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin',
      env.PATH,
    ].filter(Boolean).join(':');
  } else if (process.platform === 'linux') {
    env.PATH = [
      '/usr/local/bin', '/usr/bin', '/bin',
      env.HOME ? path.join(env.HOME, '.local', 'bin') : null,
      env.PATH,
    ].filter(Boolean).join(':');
  }
  return env;
}

/** Spawn a command, stream stdout/stderr lines to `sender` via 'setup:log'. */
function runCmd(sender, cmd, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      env: buildEnv(),
      shell: process.platform === 'win32',
      ...opts,
    });
    const emit = (d) => {
      const msg = d.toString().trim();
      if (msg) sender?.send('setup:log', msg);
    };
    proc.stdout?.on('data', emit);
    proc.stderr?.on('data', emit);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
    proc.on('error', reject);
  });
}

/** Return true if a binary is on PATH. */
function isInstalled(bin) {
  try {
    execSync(
      process.platform === 'win32' ? `where ${bin}` : `which ${bin}`,
      { env: buildEnv(), stdio: 'pipe' },
    );
    return true;
  } catch { return false; }
}

// ─── Setup steps ──────────────────────────────────────────────────────────────

async function stepSystem(sender) {
  sender.send('setup:step', { id: 'system', state: 'active', status: 'checking…' });
  const plat = { darwin: 'macOS', linux: 'Linux', win32: 'Windows' }[process.platform] || process.platform;
  sender.send('setup:log', `Platform: ${plat} ${process.arch}`);
  sender.send('setup:step', { id: 'system', state: 'done', status: plat });
}

async function stepDocker(sender) {
  sender.send('setup:step', { id: 'docker', state: 'active', status: 'checking…' });
  if (isInstalled('docker')) {
    sender.send('setup:step', { id: 'docker', state: 'skip', status: 'already installed' });
    return;
  }
  sender.send('setup:log', 'Installing Docker…');
  if (process.platform === 'darwin') {
    await runCmd(sender, 'brew', ['install', '--cask', 'docker']);
    await runCmd(sender, 'open', ['-a', 'Docker']);
  } else if (process.platform === 'linux') {
    await runCmd(sender, 'bash', ['-c',
      'apt-get update -qq && apt-get install -y docker.io docker-compose-v2 && systemctl enable --now docker',
    ]);
  } else {
    await runCmd(sender, 'winget', ['install', '-e', '--id', 'Docker.DockerDesktop', '--silent', '--accept-package-agreements']);
  }
  sender.send('setup:step', { id: 'docker', state: 'done', status: 'installed' });
}

async function stepDockerStart(sender) {
  sender.send('setup:step', { id: 'docker_start', state: 'active', status: 'waiting…' });
  const env = buildEnv();
  for (let i = 0; i < 90; i++) {
    try {
      execSync('docker info', { env, stdio: 'pipe' });
      sender.send('setup:step', { id: 'docker_start', state: 'done', status: 'running' });
      return;
    } catch { /* keep waiting */ }
    if (i === 0) sender.send('setup:log', 'Waiting for Docker daemon (up to 3 min)…');
    await sleep(2000);
  }
  throw new Error('Docker did not start within 3 minutes.\nPlease launch Docker Desktop manually, then reopen Caenan.');
}

async function stepSupabaseCLI(sender) {
  sender.send('setup:step', { id: 'supabase_cli', state: 'active', status: 'checking…' });
  if (isInstalled('supabase')) {
    sender.send('setup:step', { id: 'supabase_cli', state: 'skip', status: 'already installed' });
    return;
  }
  sender.send('setup:log', 'Installing Supabase CLI…');
  if (process.platform === 'darwin') {
    await runCmd(sender, 'brew', ['install', 'supabase/tap/supabase']);
  } else if (process.platform === 'linux') {
    await runCmd(sender, 'bash', ['-c', `
      LATEST=$(curl -s https://api.github.com/repos/supabase/cli/releases/latest | grep '"tag_name"' | cut -d'"' -f4);
      ARCH=$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/');
      curl -fsSL "https://github.com/supabase/cli/releases/download/$LATEST/supabase_linux_$ARCH.tar.gz" \\
        | tar -xz -C /usr/local/bin supabase && chmod +x /usr/local/bin/supabase
    `]);
  } else {
    await runCmd(sender, 'winget', ['install', '-e', '--id', 'Supabase.CLI', '--silent', '--accept-package-agreements']);
  }
  sender.send('setup:step', { id: 'supabase_cli', state: 'done', status: 'installed' });
}

async function stepSupabaseStart(sender) {
  sender.send('setup:step', { id: 'supabase_start', state: 'active', status: 'starting…' });
  const env = buildEnv();
  try {
    execSync('supabase status', { cwd: APP_ROOT, env, stdio: 'pipe' });
    sender.send('setup:step', { id: 'supabase_start', state: 'skip', status: 'already running' });
    return;
  } catch { /* not running yet */ }
  sender.send('setup:log', 'Running: supabase start (pulls Docker images on first run — may take a few minutes)…');
  await runCmd(sender, 'supabase', ['start'], { cwd: APP_ROOT });
  sender.send('setup:step', { id: 'supabase_start', state: 'done', status: 'running on :54321' });
}

async function stepOllama(sender) {
  sender.send('setup:step', { id: 'ollama', state: 'active', status: 'checking…' });
  if (isInstalled('ollama')) {
    sender.send('setup:step', { id: 'ollama', state: 'skip', status: 'already installed' });
  } else {
    sender.send('setup:log', 'Installing Ollama…');
    if (process.platform === 'darwin') {
      await runCmd(sender, 'brew', ['install', 'ollama']);
    } else if (process.platform === 'linux') {
      await runCmd(sender, 'bash', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh']);
    } else {
      await runCmd(sender, 'winget', ['install', '-e', '--id', 'Ollama.Ollama', '--silent', '--accept-package-agreements']);
    }
    sender.send('setup:step', { id: 'ollama', state: 'done', status: 'installed' });
  }
  // Start ollama serve in background if not already up
  try { execSync('curl -s http://localhost:11434', { stdio: 'pipe' }); }
  catch {
    spawn('ollama', ['serve'], { env: buildEnv(), detached: true, stdio: 'ignore' }).unref();
    await sleep(2000);
  }
}

async function stepModel(sender) {
  sender.send('setup:step', { id: 'model', state: 'active', status: 'checking…' });
  const env = buildEnv();
  try {
    const list = execSync('ollama list', { env, stdio: 'pipe' }).toString();
    if (list.toLowerCase().includes('eburonmax/eburon-reasoner')) {
      sender.send('setup:step', { id: 'model', state: 'skip', status: 'already present' });
      return;
    }
  } catch { /* ollama not ready yet, try pull anyway */ }
  sender.send('setup:log', 'Pulling eburonmax/eburon-reasoner — this can take several minutes…');
  await runCmd(sender, 'ollama', ['pull', 'eburonmax/eburon-reasoner']);
  sender.send('setup:step', { id: 'model', state: 'done', status: 'ready' });
}

// ─── Setup orchestrator ───────────────────────────────────────────────────────
async function runSetup(sender) {
  const steps = [
    stepSystem,
    stepDocker,
    stepDockerStart,
    stepSupabaseCLI,
    stepSupabaseStart,
    stepOllama,
    stepModel,
  ];
  for (const step of steps) {
    await step(sender);
  }
  // Write flag so we skip full setup next launch
  fs.writeFileSync(SETUP_FLAG, new Date().toISOString());
  sender.send('setup:complete');
  await sleep(2000);
}

/** Quick service-restart on subsequent launches (non-blocking). */
function startServices() {
  const env = buildEnv();
  // Supabase
  try { execSync('supabase status', { cwd: APP_ROOT, env, stdio: 'pipe' }); }
  catch {
    spawn('supabase', ['start'], { cwd: APP_ROOT, env, detached: true, stdio: 'ignore' }).unref();
  }
  // Ollama serve
  try { execSync('curl -s http://localhost:11434', { stdio: 'pipe' }); }
  catch {
    spawn('ollama', ['serve'], { env, detached: true, stdio: 'ignore' }).unref();
  }
}

// ─── Main window ──────────────────────────────────────────────────────────────
function createMainWindow() {
  const iconPath = path.join(__dirname, '..', 'build',
    process.platform === 'win32' ? 'icon.ico'
    : process.platform === 'darwin' ? 'icon.icns'
    : 'icon.png',
  );

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
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
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    setupWindow?.close();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Setup window ─────────────────────────────────────────────────────────────
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 620,
    height: 680,
    resizable: false,
    center: true,
    title: 'Caenan — Setup',
    webPreferences: {
      preload: path.join(__dirname, 'setup-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0a0a0a',
    show: false,
    frame: true,
  });

  // Load the HTML; in packaged app use the bundled copy
  const htmlPath = path.join(__dirname, 'setup.html');
  setupWindow.loadFile(htmlPath);
  setupWindow.once('ready-to-show', () => setupWindow.show());
  setupWindow.on('closed', () => { setupWindow = null; });

  ipcMain.handleOnce('setup:ready', async () => {
    const sender = setupWindow?.webContents;
    if (!sender) return;
    try {
      await runSetup(sender);
      createMainWindow();
    } catch (err) {
      sender?.send('setup:error', err.message || String(err));
    }
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  if (!fs.existsSync(iconPath)) return;
  tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16 }));
  tray.setToolTip('Caenan Local Edge');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Caenan',      click: () => mainWindow ? mainWindow.show() : createMainWindow() },
    { label: 'Supabase Studio',  click: () => shell.openExternal('http://127.0.0.1:54323') },
    { label: 'Ollama',           click: () => shell.openExternal('http://localhost:11434') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
  tray.on('double-click', () => mainWindow?.show());
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createTray();
  const firstRun = !fs.existsSync(SETUP_FLAG);
  if (firstRun) {
    createSetupWindow();
  } else {
    startServices();
    createMainWindow();
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
