const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('director', {
  isDesktop: true,
  research: url => ipcRenderer.invoke('director:research', url),
  addDocuments: () => ipcRenderer.invoke('director:add-documents'),
  addFolder: () => ipcRenderer.invoke('director:add-folder'),
  forgetFolder: () => ipcRenderer.invoke('director:forget-folder'),
  advisor: payload => ipcRenderer.invoke('director:advisor', payload),
  savePilot: opportunityId => ipcRenderer.invoke('director:save-pilot', opportunityId),
  openExternal: url => ipcRenderer.invoke('director:open-external', url),
  onProgress: callback => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('director:progress', listener);
    return () => ipcRenderer.removeListener('director:progress', listener);
  },
});
