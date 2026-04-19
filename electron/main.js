const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');

let mainWindow;
let apiServer;
const API_PORT = 3001;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'TS Concept PDV',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Em dev (vite :5173) carregamos do HMR. Em preview (`electron:preview` com
  // env PDV_PREVIEW=1) ou no build empacotado, servimos o dist/ pelo próprio
  // Express :3001.
  const usePreviewBundle = app.isPackaged || process.env.PDV_PREVIEW === '1';
  if (usePreviewBundle) {
    mainWindow.loadURL(`http://localhost:${API_PORT}`);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
}

function startApiServer() {
  const apiApp = express();
  apiApp.use(cors());
  apiApp.use(express.json({ limit: '50mb' }));

  // Initialize database
  const db = require('./api/db');

  // Load routes
  const routesDir = path.join(__dirname, 'api', 'routes');
  const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
  for (const file of routeFiles) {
    try {
      const route = require(path.join(routesDir, file));
      apiApp.use('/api', route(db));
      console.log('[route] OK:', file);
    } catch (e) {
      console.error('[route] ERRO ao carregar', file, ':', e.message);
    }
  }

  // Serve static frontend files if they exist
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    apiApp.use(express.static(distPath));
    // SPA fallback
    apiApp.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  apiServer = apiApp.listen(API_PORT, () => {
    console.log(`API server running on http://localhost:${API_PORT}`);
  });

  apiServer.on('error', (err) => {
    console.error('Erro no servidor API:', err.code, err.message);
  });
}


function scheduleAutoBackup() {
  const DATA_DIR = path.join(process.env.APPDATA || process.env.HOME, 'pdv-loja-roupas');
  const BACKUP_DIR = path.join(DATA_DIR, 'backups-auto');
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const db = require('./api/db');

  const doBackup = async () => {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const dest = path.join(BACKUP_DIR, `backup-auto-${stamp}`);
      fs.mkdirSync(dest, { recursive: true });

      // Primary: online SQLite backup (safe even while the DB is in use).
      await db.backupTo(path.join(dest, 'pdv.sqlite'));

      // Secondary: JSON snapshot of every table, for debug and manual inspection.
      const snapshot = {};
      for (const table of Object.keys(db._data)) {
        snapshot[table] = db._data[table];
      }
      fs.writeFileSync(path.join(dest, 'snapshot.json'), JSON.stringify(snapshot, null, 2));

      // Keep only last 7 auto backups
      const existing = fs.readdirSync(BACKUP_DIR).sort();
      if (existing.length > 7) {
        existing.slice(0, existing.length - 7).forEach(d => {
          fs.rmSync(path.join(BACKUP_DIR, d), { recursive: true, force: true });
        });
      }
    } catch (e) { console.error('Backup automático falhou:', e); }
  };

  doBackup(); // backup ao iniciar
  setInterval(doBackup, 24 * 60 * 60 * 1000); // a cada 24h
}

// Prevent multiple Electron instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  console.log('[Electron] Outra instância já está rodando. Encerrando.');
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  if (!gotTheLock) return;
  try {
    startApiServer();
  } catch (e) {
    console.error('[FATAL] startApiServer falhou:', e.message, e.stack);
  }
  try {
    scheduleAutoBackup();
  } catch (e) {
    console.error('[FATAL] scheduleAutoBackup falhou:', e.message);
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (apiServer) apiServer.close();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('dialog:print', async (event, content) => {
  return { success: true };
});

ipcMain.handle('get-printers', async () => {
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch {
    return [];
  }
});

ipcMain.handle('print-receipt', async (event, html, printerName) => {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    win.webContents.once('did-finish-load', () => {
      win.webContents.print(
        { silent: true, deviceName: printerName || '', printBackground: false },
        (success, reason) => {
          win.close();
          resolve({ success, reason });
        }
      );
    });
  });
});
