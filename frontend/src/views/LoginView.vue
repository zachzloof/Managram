<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
    <!-- Background accent glow -->
    <div class="absolute inset-0 overflow-hidden pointer-events-none">
      <div class="absolute -top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-accent-500/10 blur-3xl animate-pulse-slow" />
      <div class="absolute -bottom-1/4 -right-1/4 w-[500px] h-[500px] rounded-full bg-accent-600/[0.06] blur-3xl animate-pulse-slow" style="animation-delay: 1s" />
    </div>

    <div class="w-full max-w-md relative z-10">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent-500 mb-4">
          <span class="text-white text-3xl font-bold font-data">M</span>
        </div>
        <h1 class="text-4xl font-bold text-white mb-2 tracking-tight">Managram</h1>
        <p class="text-gray-400">Professional Instagram content management</p>
      </div>

      <!-- Setup steps -->
      <div class="card mb-6">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Setup Steps</h2>
        <div class="space-y-3">
          <div v-for="(step, i) in setupSteps" :key="i" class="flex items-center gap-3">
            <div
              class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
              :class="step.done ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-500 border border-white/10'"
            >
              <CheckIcon v-if="step.done" class="w-3.5 h-3.5" />
              <span v-else>{{ i + 1 }}</span>
            </div>
            <span class="text-sm" :class="step.done ? 'text-green-400' : 'text-gray-400'">
              {{ step.label }}
            </span>
          </div>
        </div>
      </div>

      <!-- App Credentials -->
      <div class="card mb-4">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">App Credentials</h2>
        <div class="space-y-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Instagram App ID</label>
            <input v-model="appId" type="text" placeholder="Enter your App ID" class="input-field" @input="saveCredentials" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Instagram App Secret</label>
            <input v-model="appSecret" type="password" :placeholder="hasStoredAppSecret ? 'App Secret saved — paste new one to replace' : 'Enter your App Secret'" class="input-field" @input="saveCredentials" />
            <p v-if="hasStoredAppSecret && !appSecret" class="text-green-400 text-xs mt-1 flex items-center gap-1">
              <CheckCircleIcon class="w-3 h-3" /> App Secret already saved
            </p>
          </div>
        </div>
        <p v-if="credentialsSaved" class="text-green-400 text-xs mt-2 flex items-center gap-1">
          <CheckCircleIcon class="w-3.5 h-3.5" /> Credentials saved
        </p>
      </div>

      <!-- Redirect URI (R2/hosted mode) -->
      <div v-if="isR2Mode" class="card mb-4">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">Redirect URI</h2>
        <p class="text-gray-500 text-xs mb-3">Add this URL to your app's allowed redirect URIs in the Meta Developer portal.</p>
        <div class="rounded-lg bg-white/5 border border-white/10 p-3">
          <div class="flex items-center gap-2">
            <code class="text-green-400 text-xs flex-1 break-all">{{ redirectUri }}</code>
            <button @click="copyRedirectUri" class="shrink-0 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10">
              {{ copied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ngrok Tunnel (local/Electron mode only) -->
      <div v-if="!isR2Mode" class="card mb-4">
        <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-1">HTTPS Tunnel</h2>
        <p class="text-gray-500 text-xs mb-4">Required so Instagram can reach your local server. Get a free authtoken at <span class="text-accent-400">ngrok.com</span></p>

        <div class="space-y-3">
          <div>
            <label class="block text-sm text-gray-400 mb-1.5">ngrok Authtoken</label>
            <input v-model="ngrokAuthtoken" type="password" :placeholder="hasStoredAuthtoken ? 'Authtoken saved — paste new one to replace' : 'Paste your authtoken'" class="input-field" />
            <p v-if="hasStoredAuthtoken && !ngrokAuthtoken" class="text-green-400 text-xs mt-1 flex items-center gap-1">
              <CheckCircleIcon class="w-3 h-3" /> Authtoken already saved
            </p>
          </div>

          <!-- Status -->
          <div v-if="ngrokStatus !== 'disconnected'" class="flex items-center gap-2 text-sm">
            <div
              class="w-2 h-2 rounded-full shrink-0"
              :class="{
                'bg-yellow-400 animate-pulse': ngrokStatus === 'connecting',
                'bg-green-400': ngrokStatus === 'connected',
                'bg-red-400': ngrokStatus === 'error',
              }"
            />
            <span :class="{
              'text-yellow-400': ngrokStatus === 'connecting',
              'text-green-400': ngrokStatus === 'connected',
              'text-red-400': ngrokStatus === 'error',
            }">
              {{ ngrokStatusLabel }}
            </span>
          </div>

          <!-- Tunnel URL to copy -->
          <div v-if="ngrokUrl" class="rounded-lg bg-white/5 border border-white/10 p-3">
            <p class="text-xs text-gray-400 mb-1.5">Your redirect URI — paste this into the Facebook portal:</p>
            <div class="flex items-center gap-2">
              <code class="text-green-400 text-xs flex-1 break-all">{{ ngrokUrl }}/auth/callback</code>
              <button @click="copyRedirectUri" class="shrink-0 text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10">
                {{ copied ? 'Copied!' : 'Copy' }}
              </button>
            </div>
          </div>

          <button
            @click="startTunnel"
            :disabled="(!ngrokAuthtoken && !hasStoredAuthtoken) || ngrokStatus === 'connecting'"
            class="w-full py-2.5 rounded-xl text-sm font-semibold text-white border border-white/10
                   bg-white/5 hover:bg-white/10 transition-all duration-200
                   disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg v-if="ngrokStatus === 'connecting'" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ ngrokStatus === 'connecting' ? 'Starting tunnel...' : ngrokStatus === 'connected' ? 'Restart Tunnel' : 'Start Tunnel' }}
          </button>
        </div>
      </div>

      <!-- Connect button -->
      <button
        @click="connectInstagram"
        :disabled="!appId || (!appSecret && !hasStoredAppSecret) || (!isR2Mode && !ngrokUrl) || connecting"
        class="w-full py-3 rounded-lg font-semibold text-white bg-accent-500
               hover:bg-accent-400 active:scale-95 transition-all duration-200
               disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg v-if="connecting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <svg v-else viewBox="0 0 24 24" class="w-5 h-5 fill-white">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
        {{ connecting ? 'Connecting...' : 'Connect with Instagram' }}
      </button>

      <p v-if="!isR2Mode && !ngrokUrl" class="text-center text-gray-600 text-xs mt-3">
        Start the tunnel above to enable the Connect button
      </p>

      <!-- Divider -->
      <div class="flex items-center gap-3 my-4">
        <div class="flex-1 h-px bg-white/5" />
        <span class="text-gray-600 text-xs">or</span>
        <div class="flex-1 h-px bg-white/5" />
      </div>

      <!-- Manual token -->
      <div class="card">
        <button @click="showManualToken = !showManualToken" class="w-full flex items-center justify-between text-left">
          <div>
            <p class="text-sm font-medium text-gray-300">Paste token from Meta portal</p>
            <p class="text-xs text-gray-500 mt-0.5">Use "Generate Access Tokens" in your app's use case settings</p>
          </div>
          <ChevronDownIcon class="w-4 h-4 text-gray-500 transition-transform duration-200" :class="{ 'rotate-180': showManualToken }" />
        </button>

        <div v-if="showManualToken" class="mt-4 space-y-3">
          <div class="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-300 space-y-1">
            <p class="font-medium">How to get your token:</p>
            <p>1. In Meta Developer portal → your app → use case</p>
            <p>2. Click <strong>"API setup with Instagram login"</strong></p>
            <p>3. Find <strong>"Generate Access Tokens"</strong> → click Generate next to your account</p>
            <p>4. Copy the token and paste it below</p>
          </div>

          <div>
            <label class="block text-sm text-gray-400 mb-1.5">Access Token</label>
            <textarea
              v-model="manualToken"
              rows="3"
              placeholder="Paste your access token here..."
              class="input-field resize-none text-xs font-mono"
            />
          </div>

          <p v-if="manualTokenError" class="text-red-400 text-xs flex items-start gap-1">
            <XCircleIcon class="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {{ manualTokenError }}
          </p>

          <button
            @click="connectWithToken"
            :disabled="!manualToken.trim() || manualTokenLoading"
            class="w-full py-2.5 rounded-lg text-sm font-semibold text-white bg-accent-500
                   hover:bg-accent-400 transition-all duration-200
                   disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <svg v-if="manualTokenLoading" class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ manualTokenLoading ? 'Connecting...' : 'Connect with Token' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { CheckIcon, CheckCircleIcon, XCircleIcon, ChevronDownIcon } from '@heroicons/vue/24/solid'
import axios from 'axios'

const appId = ref('')
const appSecret = ref('')
const hasStoredAppSecret = ref(false)
const ngrokAuthtoken = ref('')
const hasStoredAuthtoken = ref(false)
const ngrokStatus = ref('disconnected')
const ngrokUrl = ref('')
const ngrokError = ref('')
const connecting = ref(false)
const credentialsSaved = ref(false)
const copied = ref(false)
const showManualToken = ref(false)
const manualToken = ref('')
const manualTokenLoading = ref(false)
const manualTokenError = ref('')
const isR2Mode = ref(false)
let saveTimeout = null

const redirectUri = computed(() => `${window.location.origin}/auth/callback`)

const ngrokStatusLabel = computed(() => {
  if (ngrokStatus.value === 'connecting') return 'Starting tunnel...'
  if (ngrokStatus.value === 'connected') return `Tunnel active`
  if (ngrokStatus.value === 'error') return `Error: ${ngrokError.value}`
  return 'Disconnected'
})

const setupSteps = computed(() => {
  if (isR2Mode.value) {
    return [
      { label: 'Create an Instagram Developer App', done: !!appId.value && !!appSecret.value },
      { label: `Add ${redirectUri.value} to Facebook portal`, done: !!appId.value },
      { label: 'Connect your Instagram account below', done: false },
    ]
  }
  return [
    { label: 'Create an Instagram Developer App', done: !!appId.value && !!appSecret.value },
    { label: 'Start HTTPS tunnel and copy redirect URI', done: !!ngrokUrl.value },
    { label: 'Add redirect URI to Facebook portal', done: !!ngrokUrl.value },
    { label: 'Connect your Instagram account below', done: false },
  ]
})

async function saveCredentials() {
  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(async () => {
    if (!appId.value && !appSecret.value) return
    try {
      const body = {}
      if (appId.value) body.app_id = appId.value
      if (appSecret.value) body.app_secret = appSecret.value
      await axios.post('/settings', body)
      credentialsSaved.value = true
      setTimeout(() => { credentialsSaved.value = false }, 3000)
    } catch (err) {
      console.error('Failed to save credentials:', err)
    }
  }, 800)
}

async function startTunnel() {
  const tokenToUse = ngrokAuthtoken.value || null
  if (!tokenToUse && !hasStoredAuthtoken.value) return

  ngrokStatus.value = 'connecting'
  ngrokUrl.value = ''
  ngrokError.value = ''

  // Save new authtoken if one was entered
  if (tokenToUse) {
    await axios.post('/settings', { ngrok_authtoken: tokenToUse })
    hasStoredAuthtoken.value = true
  }

  if (window.electronAPI) {
    const status = await window.electronAPI.restartNgrok(tokenToUse)
    if (status.status === 'connected' && status.url) {
      ngrokStatus.value = 'connected'
      ngrokUrl.value = status.url
    } else if (status.status === 'error') {
      ngrokStatus.value = 'error'
      ngrokError.value = status.error || 'Failed to start tunnel'
    }
  } else {
    ngrokStatus.value = 'error'
    ngrokError.value = 'Run the app via Electron to auto-start the tunnel'
  }
}

async function copyRedirectUri() {
  const uri = isR2Mode.value ? redirectUri.value : `${ngrokUrl.value}/auth/callback`
  await navigator.clipboard.writeText(uri)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

async function connectInstagram() {
  if (!appId.value || (!appSecret.value && !hasStoredAppSecret.value) || (!isR2Mode.value && !ngrokUrl.value)) return
  connecting.value = true
  try {
    const body = { app_id: appId.value }
    if (appSecret.value) body.app_secret = appSecret.value
    await axios.post('/settings', body)
  } catch (err) {
    console.error('Failed to save credentials:', err)
  }
  window.location.href = '/auth/instagram'
}

async function connectWithToken() {
  if (!manualToken.value.trim()) return
  manualTokenLoading.value = true
  manualTokenError.value = ''
  try {
    await axios.post('/auth/token', { access_token: manualToken.value.trim() })
    // Reload the page — auth store will pick up the new session
    window.location.href = '/'
  } catch (err) {
    manualTokenError.value = err.response?.data?.error || 'Invalid token — make sure you copied the full token'
    manualTokenLoading.value = false
  }
}

onMounted(async () => {
  try {
    const response = await axios.get('/settings')
    const s = response.data.settings
    if (s.app_id) appId.value = s.app_id
    if (s.app_secret) hasStoredAppSecret.value = true
    if (s.ngrok_authtoken) hasStoredAuthtoken.value = true
    isR2Mode.value = s.storage_mode === 'r2'

    // Check if tunnel is already running (Electron auto-started it)
    if (window.electronAPI) {
      const status = await window.electronAPI.getNgrokStatus()
      if (status.status === 'connected' && status.url) {
        ngrokStatus.value = 'connected'
        ngrokUrl.value = status.url
      }

      window.electronAPI.onNgrokUrl((url) => {
        ngrokStatus.value = 'connected'
        ngrokUrl.value = url
      })
      window.electronAPI.onNgrokError((msg) => {
        ngrokStatus.value = 'error'
        ngrokError.value = msg
      })
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
  }
})
</script>
