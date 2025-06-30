const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const screenshot = require('screenshot-desktop');
const fetch = require('node-fetch'); // Ensure version 2.x
const FormData = require('form-data');
let userId = 1;

let loginWindow, trackerWindow;
let screenshotInterval = null;
let startTime = null;
let pauseTime = null;
let endTime = null;

const tempFile = path.join(__dirname, 'temp.jpg');

function createLoginWindow() {
  loginWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets/icons/win/icon.png'),
  });

  loginWindow.loadFile('index.html');

  loginWindow.on('closed', () => {
    loginWindow = null;
  });
}

function formatDateForMySQL(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function openTrackerWindow(userData) {
  if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();

  trackerWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'assets/icons/win/icon.png'),
  });

  trackerWindow.loadFile('tracker.html');

  trackerWindow.webContents.on('did-finish-load', () => {
    trackerWindow.webContents.send('user-data', userData);
  });

  trackerWindow.on('closed', () => {
    trackerWindow = null;
  });
}

app.whenReady().then(() => {
  createLoginWindow();

  ipcMain.on('login-success', (event, userData) => {
    userId = userData.id;
    openTrackerWindow(userData);
  });

  ipcMain.on('logout', () => {
    if (trackerWindow) trackerWindow.close();
    createLoginWindow();
  });

  ipcMain.on('start-tracking', async () => {
    if (screenshotInterval) return;

    console.log('📸 Tracking started...');
    startTime = new Date();
    pauseTime = null;
    endTime = null;

    try {
      const response = await fetch('https://kiglobals.com/api/timelog/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          start_time: formatDateForMySQL(startTime), // e.g., 2025-06-30 11:12:13
        }),
      });

      const data = await response.json();
      console.log('✅ Start API response:', data);
    } catch (error) {
      console.error('❌ Start API error:', error);
    }

    screenshotInterval = setInterval(() => {
      screenshot({ format: 'jpg' })
        .then((img) => {
          fs.writeFileSync(tempFile, img);
          uploadScreenshot(tempFile);
        })
        .catch((err) => {
          console.error('❌ Screenshot error:', err);
          dialog.showErrorBox('Screenshot Error', `An error occurred while taking a screenshot:\n${err.message}`);
        });
    }, 60000); // Every 60 seconds
  });

  ipcMain.on('pause-tracking', async () => {
    pauseTime = new Date();

    try {
      const response = await fetch('https://kiglobals.com/api/timelog/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          pause_time: pauseTime.toISOString(),
        }),
      });

      const data = await response.json();
      console.log('✅ Pause API response:', data);
    } catch (error) {
      console.error('❌ Pause API error:', error);
    }
  });

  ipcMain.on('resume-tracking', () => {
    console.log('▶️ Resumed tracking.');
    pauseTime = null;
    // You can optionally add an API call here to log resume time
  });

  ipcMain.on('stop-tracking', async (event) => {
    if (!screenshotInterval) return;

    clearInterval(screenshotInterval);
    screenshotInterval = null;

    endTime = new Date();
    const durationMs = endTime - startTime;
    const durationSec = Math.floor(durationMs / 1000);

    try {
      const response = await fetch('https://kiglobals.com/api/timelog/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          end_time: endTime.toISOString(),
          total_time: durationSec,
        }),
      });

      const data = await response.json();
      console.log('✅ Stop API response:', data);
    } catch (error) {
      console.error('❌ Stop API error:', error);
    }

    event.reply('tracking-stopped', durationSec);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createLoginWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Upload Screenshot
async function uploadScreenshot(filePath) {
  const form = new FormData();
  form.append('user_id', userId.toString());
  form.append('image', fs.createReadStream(filePath));

  try {
    const response = await fetch('https://kiglobals.com/api/screenshots', {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    const result = await response.text(); // Use .json() if the server responds with JSON

    console.log(`✅ Screenshot uploaded. Status: ${response.status}`, result);

    if (!response.ok) {
      dialog.showErrorBox('Upload Failed', `Server responded with status: ${response.status}\n${result}`);
    }
  } catch (err) {
    console.error('❌ Upload error:', err.message);
    dialog.showErrorBox('Upload Error', `An error occurred while uploading the screenshot:\n${err.message}`);
  }
}
