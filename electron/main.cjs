const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createFileViewerServer } = require('../server/createServer.cjs');

function parseArgs(argv) {
  const out = {
    ui: false,
    dir: process.cwd(),
    host: '0.0.0.0',
    port: 8787,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--ui') out.ui = true;
    else if (a === '--dir' && argv[i + 1]) {
      out.dir = argv[++i];
    } else if (a.startsWith('--dir=')) {
      out.dir = a.slice('--dir='.length);
    } else if (a === '--host' && argv[i + 1]) {
      out.host = argv[++i];
    } else if (a.startsWith('--host=')) {
      out.host = a.slice('--host='.length);
    } else if ((a === '--port' || a === '-p') && argv[i + 1]) {
      out.port = Number(argv[++i]);
    } else if (a.startsWith('--port=')) {
      out.port = Number(a.slice('--port='.length));
    } else if (a.startsWith('-p') && a.length > 2 && a[2] !== '-') {
      out.port = Number(a.slice(2));
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const distDir = path.join(__dirname, '..', 'dist');
const iconPath = path.join(__dirname, 'icon.png');

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('[file-viewer] missing dist/index.html — run: pnpm run build');
  process.exit(1);
}

let rootDir = path.resolve(args.dir);
if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
  console.error(`[file-viewer] --dir is not a directory: ${rootDir}`);
  process.exit(1);
}

/** @type {ReturnType<typeof createFileViewerServer> | null} */
let fvServer = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow(serverUrl) {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 720,
    minHeight: 480,
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[file-viewer] did-fail-load', { code, desc, url });
  });
  win.loadURL(serverUrl).catch((err) => {
    console.error('[file-viewer] loadURL failed', err);
  });
  return win;
}

ipcMain.handle('fv:pickDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const next = result.filePaths[0];
  if (!fvServer) return null;
  const state = fvServer.setRootDir(next);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('fv:root-changed', state);
  }
  return state;
});

ipcMain.handle('fv:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'All Files', extensions: ['*'] }],
  });
  if (result.canceled || !result.filePaths.length) return [];
  return result.filePaths.map((filePath) => {
    const stat = fs.statSync(filePath);
    const data = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      size: stat.size,
      lastModified: Math.floor(stat.mtimeMs),
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    };
  });
});

app.whenReady().then(async () => {
  if (process.platform === 'linux' && fs.existsSync(iconPath)) {
    try {
      app.dock?.setIcon?.(iconPath);
    } catch {
      /* ignore */
    }
  }

  fvServer = createFileViewerServer({
    rootDir,
    host: args.host,
    port: args.port,
    distDir,
    canPickDir: Boolean(args.ui),
  });

  const info = await fvServer.start();
  console.log(`[file-viewer] server ${info.url}  root=${info.rootDir}`);
  console.log(`[file-viewer] mode=${args.ui ? 'ui' : 'headless'}`);

  if (args.ui) {
    mainWindow = createWindow(info.url);
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        mainWindow = createWindow(info.url);
      }
    });
  } else {
    // Headless: keep process alive via open server handle.
    console.log('[file-viewer] headless — open the Network URL from another device/browser');
  }
});

app.on('window-all-closed', () => {
  if (!args.ui) return;
  // With UI, closing the window exits (server stops with process).
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (fvServer) {
    fvServer.stop().catch(() => {});
  }
});
