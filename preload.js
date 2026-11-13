const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('dropGeniusAI', {
  generate: (message) => {
    if (typeof message !== 'string' || !message.trim()) {
      return Promise.resolve({
        success: false,
        error: 'A valid message is required.'
      });
    }

    if (message.length > 2000) {
      return Promise.resolve({
        success: false,
        error: 'Message must be 2000 characters or fewer.'
      });
    }

    return ipcRenderer.invoke('ai:generate', message);
  }
});