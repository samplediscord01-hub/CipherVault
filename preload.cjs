const { contextBridge, ipcRenderer } = require('electron');

ipcRenderer.on('server-info', (event, serverInfo) => {
  if (serverInfo && serverInfo.port) {
    contextBridge.exposeInMainWorld('electronAPI', {
      serverAddress: `http://localhost:${serverInfo.port}`
    });
  }
});
