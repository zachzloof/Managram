const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron')
const path = require('path')
const licenseManager = require('./license-manager')

const isDev = process.env.NODE_ENV === 'development'
const SKIP_LICENSE = process.env.MANAGRAM_SKIP_LICENSE === 'true'

let mainWindow = null

async function initBackend() {
  // Point the database to the user data dir when packaged
  if (!isDev) {
    process.env.DB_PATH = path.join(app.getPath('userData'), 'managram.db')
  }
  const { startServer } = require('../backend/src/index')
  await startServer()
  console.log('[Electron] Backend started on port 3001')
}

// Good-faith access gate (see electron/license-manager.js) — not run at all
// in dev with MANAGRAM_SKIP_LICENSE=true, so local development doesn't
// require a live license server.
async function checkLicense() {
  if (SKIP_LICENSE) return { state: 'valid' }
  const localLicenseGate = require('../backend/src/services/localLicenseGate')
  const result = await licenseManager.refresh()
  localLicenseGate.setValid(result.state === 'valid')
  return result
}

async function initNgrok() {
  const ngrokManager = require('./ngrok-manager')
  try {
    const url = await ngrokManager.start()
    if (url) {
      console.log('[Electron] ngrok tunnel:', url)
      mainWindow?.webContents.send('ngrok-url', url)
    }
  } catch (err) {
    console.warn('[Electron] ngrok error:', err.message)
    mainWindow?.webContents.send('ngrok-error', err.message)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0a0a0f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'))
  }
}

// IPC: native folder picker
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Content Folder',
  })
  return result.canceled ? null : result.filePaths[0]
})

// IPC: ngrok status
ipcMain.handle('get-ngrok-status', () => {
  const ngrokManager = require('./ngrok-manager')
  return ngrokManager.getStatus()
})

// IPC: restart ngrok with new authtoken
ipcMain.handle('restart-ngrok', async (_, authtoken) => {
  const ngrokManager = require('./ngrok-manager')
  const url = await ngrokManager.restart(authtoken)
  const status = ngrokManager.getStatus()
  if (url) {
    mainWindow?.webContents.send('ngrok-url', url)
  } else {
    mainWindow?.webContents.send('ngrok-error', status.error || 'Failed to start tunnel')
  }
  return status
})

// IPC: license gate — renderer asks for current status, and drives login
ipcMain.handle('license-status', async () => {
  if (SKIP_LICENSE) return { state: 'valid' }
  return licenseManager.getStatus()
})

ipcMain.handle('license-login', async (_, { email, password }) => {
  try {
    const result = await licenseManager.login(email, password)
    require('../backend/src/services/localLicenseGate').setValid(result.state === 'valid')
    return result
  } catch (err) {
    return { state: 'error', error: err.message }
  }
})

app.whenReady().then(async () => {
  if (!SKIP_LICENSE) {
    // Deny by default until the very first check resolves — fail closed,
    // not open, while that network round-trip is in flight.
    require('../backend/src/services/localLicenseGate').setValid(false)
  }

  try {
    await initBackend()
  } catch (err) {
    // The backend failed to even start (e.g. port already in use, a
    // corrupted local database). Without this, the app would just sit with
    // no window and no explanation — show something the user can actually
    // act on or report, instead of a silent non-functional app.
    console.error('[Electron] Backend failed to start:', err.stack || err.message)
    dialog.showErrorBox(
      'Managram failed to start',
      `The app's backend could not start, so Managram can't run right now.\n\n${err.message}\n\nIf this keeps happening, check that no other copy of Managram is already running, and check the logs for more detail.`
    )
    app.quit()
    return
  }

  createWindow()

  try {
    const status = await checkLicense()
    mainWindow?.webContents.send('license-status', status)
  } catch (err) {
    // A failed license check (e.g. no network on first run) shouldn't be
    // fatal — fall back to whatever the cached/default state already is
    // and let the renderer's own gate UI explain what's going on.
    console.warn('[Electron] License check failed:', err.message)
  }

  initNgrok() // non-blocking — fires in background

  // Re-check opportunistically while running, so a revoke/lapse is caught
  // even if the app is left open for days.
  setInterval(async () => {
    try {
      const result = await checkLicense()
      mainWindow?.webContents.send('license-status', result)
    } catch (err) {
      console.warn('[Electron] Periodic license check failed:', err.message)
    }
  }, 6 * 60 * 60 * 1000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}).catch((err) => {
  console.error('[Electron] Fatal startup error:', err.stack || err.message)
  dialog.showErrorBox('Managram failed to start', err.message || 'Unknown error — check the logs for detail.')
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  const ngrokManager = require('./ngrok-manager')
  await ngrokManager.stop()
})
