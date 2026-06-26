const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getCommodities: () => ipcRenderer.invoke('get-commodities'),
  fetchCommodity: (id, historyDays) => ipcRenderer.invoke('fetch-commodity', id, historyDays),
  fetchAll: (historyDays) => ipcRenderer.invoke('fetch-all', historyDays),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onFetchProgress: (callback) => {
    ipcRenderer.on('fetch-progress', (event, data) => callback(data));
  },
  removeFetchProgressListener: () => {
    ipcRenderer.removeAllListeners('fetch-progress');
  }
});
