import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { startServer, stopServer } from './server/index.js';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverInfo;

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('server-info', serverInfo);
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'dist/public/index.html'));
  }
}

async function healthCheck(port) {
  for (let i = 0; i < 10; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return;
      }
    } catch (e) {
      console.error('Health check attempt failed:', e);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Server health check failed');
}

app.whenReady().then(async () => {
  try {
    serverInfo = await startServer();
    await healthCheck(serverInfo.port);
    createWindow();
  } catch (error) {
    console.error('Failed to start server or health check failed:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', async (event) => {
  event.preventDefault();
  try {
    await stopServer();
  } catch (error) {
    console.error('Failed to stop server:', error);
  } finally {
    app.exit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
