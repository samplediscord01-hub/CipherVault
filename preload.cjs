const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  receive: (channel, func) => {
    let validChannels = ['server-info'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender`
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});

ipcRenderer.on('server-info', (event, serverInfo) => {
  contextBridge.exposeInMainWorld('electronAPI', {
    serverAddress: `http://localhost:${serverInfo.port}`
  });
});
