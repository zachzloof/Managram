const { getSetting, setSetting } = require('../backend/src/database')

let listener = null
let currentUrl = null
let currentStatus = 'disconnected'
let currentError = null

async function start(authtokenOverride) {
  currentStatus = 'connecting'
  currentError = null

  const authtoken = authtokenOverride || getSetting('ngrok_authtoken')
  if (!authtoken) {
    currentStatus = 'error'
    currentError = 'No ngrok authtoken saved.'
    return null
  }

  try {
    const ngrok = require('@ngrok/ngrok')

    if (listener) {
      try { await listener.close() } catch (_) {}
      listener = null
    }

    // ngrok v1.x uses forward(), with a 30s timeout
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Tunnel connection timed out after 30 seconds')), 30000)
    )

    listener = await Promise.race([
      ngrok.forward({ addr: 3001, authtoken }),
      timeout,
    ])

    currentUrl = listener.url()
    currentStatus = 'connected'
    setSetting('public_url', currentUrl)
    return currentUrl
  } catch (err) {
    currentStatus = 'error'
    currentError = err.message
    listener = null
    return null
  }
}

async function stop() {
  if (listener) {
    try { await listener.close() } catch (_) {}
    listener = null
  }
  currentUrl = null
  currentStatus = 'disconnected'
}

async function restart(authtoken) {
  if (authtoken) setSetting('ngrok_authtoken', authtoken)
  await stop()
  return start(authtoken)
}

function getStatus() {
  return { status: currentStatus, url: currentUrl, error: currentError }
}

module.exports = { start, stop, restart, getStatus }
