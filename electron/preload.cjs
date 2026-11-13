const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileViewer', {
  isShell: true,
  canPickDir: true,
  pickDirectory: () => ipcRenderer.invoke('fv:pickDirectory'),
  openFiles: () => ipcRenderer.invoke('fv:openFiles'),
  onRootChanged: (cb) => {
    const handler = (_event, state) => cb(state);
    ipcRenderer.on('fv:root-changed', handler);
    return () => ipcRenderer.removeListener('fv:root-changed', handler);
  },
});
