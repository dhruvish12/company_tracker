const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginSuccess: (user) => ipcRenderer.send('login-success', user),
  logout: () => ipcRenderer.send('logout'),
  startTracking: (accessToken) => ipcRenderer.send('start-tracking', accessToken),
    stopTracking: () => ipcRenderer.send('stop-tracking'),
   pauseTracking: () => ipcRenderer.send('pause-tracking'),
    resumeTracking: () => ipcRenderer.send('resume-tracking'),
  onTrackingStopped: (callback) => ipcRenderer.on('tracking-stopped', (event, duration) => callback(duration))
});
