const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getNgrokStatus: () => ipcRenderer.invoke('get-ngrok-status'),
  restartNgrok: (authtoken) => ipcRenderer.invoke('restart-ngrok', authtoken),
  onNgrokUrl: (cb) => ipcRenderer.on('ngrok-url', (_, url) => cb(url)),
  onNgrokError: (cb) => ipcRenderer.on('ngrok-error', (_, msg) => cb(msg)),
  getLicenseStatus: () => ipcRenderer.invoke('license-status'),
  licenseLogin: (email, password) => ipcRenderer.invoke('license-login', { email, password }),
  onLicenseStatus: (cb) => ipcRenderer.on('license-status', (_, status) => cb(status)),
})
