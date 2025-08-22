const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', { folderPath: settings.folderPath }),
});