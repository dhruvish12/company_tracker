const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  start: () => ipcRenderer.send('start-tracking'),
  stop: () => ipcRenderer.send('stop-tracking'),
  onStop: (callback) => ipcRenderer.on('tracking-stopped', (event, duration) => callback(duration))
});
