const { app, BrowserWindow, ipcMain } = require('electron');
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

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadURL(`http://localhost:${API_PORT}`);
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
    const route = require(path.join(routesDir, file));
    apiApp.use('/api', route(db));
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
}


app.whenReady().then(() => {
  startApiServer();
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
  // Simple print simulation - in production would use actual printer
  return { success: true };
});
