const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');

// Securely forward AI generation requests to the local backend.
ipcMain.handle('dropgenius:ai-generate', async (_event, message) => {
  if (typeof message !== 'string' || !message.trim()) {
    return {
      success: false,
      error: 'A valid message is required.'
    };
  }

  if (message.length > 2000) {
    return {
      success: false,
      error: 'Message must be 2000 characters or fewer.'
    };
  }

  try {
    const response = await fetch(
      'http://127.0.0.1:8787/api/ai/generate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message }),
        signal: AbortSignal.timeout(35000)
      }
    );

    const data = await response.json();

    if (!response.ok || data.success !== true ||
        typeof data.reply !== 'string') {
      return {
        success: false,
        error: data.error || `Backend returned HTTP ${response.status}.`
      };
    }

    return {
      success: true,
      mode: data.mode || 'unknown',
      reply: data.reply
    };
  } catch (error) {
    console.error('[DropGenius AI] Backend request failed:', error);

    return {
      success: false,
      error: 'Could not reach the backend. Make sure the server is running.'
    };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 940,
    minHeight: 640,
    backgroundColor: '#05060a',
    title: 'DropGenius AI',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});