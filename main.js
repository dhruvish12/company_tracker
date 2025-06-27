const { app, BrowserWindow, ipcMain,dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const screenshot = require('screenshot-desktop');
const fetch = require('node-fetch'); // Use node-fetch@2
const FormData = require('form-data');

let screenshotInterval = null;
let startTime = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  const tempFile = path.join(__dirname, 'temp.jpg');

  ipcMain.on('start-tracking', () => {
    if (screenshotInterval) return;

    console.log('Tracking started...');
    startTime = new Date();

    screenshotInterval = setInterval(() => {
      screenshot({ format: 'jpg' })
        .then((img) => {
          fs.writeFileSync(tempFile, img);
          uploadScreenshot(tempFile);
        })
        .catch((err) => {
          console.error('❌ Screenshot error:', err);
          dialog.showErrorBox('Screenshot Error', `An error occurred while taking a screenshot:\n${err.message || err}`);
        });
    }, 10000); // every 10 seconds
  });

  ipcMain.on('stop-tracking', (event) => {
    if (screenshotInterval) {
      clearInterval(screenshotInterval);
      screenshotInterval = null;

      const endTime = new Date();
      const durationMs = endTime - startTime;
      const durationSec = Math.floor(durationMs / 1000);

      console.log('Tracking stopped. Duration (sec):', durationSec);
      event.reply('tracking-stopped', durationSec);
    }
  });
});

async function uploadScreenshot(filePath) {
  const form = new FormData();
  form.append('user_id', '1');
  form.append('image', fs.createReadStream(filePath));

  try {
    const response = await fetch('https://kalathiyainfotechapi.in/api/screenshots', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const result = await response.text(); // Change to .json() if response is JSON
    console.log(`✅ Uploaded: ${response.status}`, result);

    if (response.ok) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Upload Successful',
        message: 'Screenshot uploaded successfully!'
      });
    } else {
      dialog.showErrorBox('Upload Failed', `Failed to upload screenshot. Server responded with status: ${response.status}\n${result}`);
    }
  } catch (err) {
    console.error('❌ Upload error:', err.message);
    dialog.showErrorBox('Upload Error', `An error occurred while uploading the screenshot:\n${err.message}`);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
