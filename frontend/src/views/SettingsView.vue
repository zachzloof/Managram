<template>
  <div class="p-6 space-y-6 max-w-2xl">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-white">Settings</h1>
      <p class="text-gray-400 text-sm mt-0.5">Configure your Managram instance</p>
    </div>

    <!-- Billing (hosted mode only) -->
    <div v-if="accountStore.hostedMode" class="card">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center">
          <CreditCardIcon class="w-4 h-4 text-accent-400" />
        </div>
        <h2 class="text-base font-semibold text-white">Billing</h2>
      </div>
      <div class="flex items-center justify-between">
        <div>
          <p class="text-white text-sm">Status: <span class="capitalize">{{ accountStore.account?.status || '—' }}</span></p>
          <p class="text-gray-500 text-xs mt-0.5">{{ accountStore.account?.email }}</p>
        </div>
        <div class="flex gap-2">
          <button v-if="accountStore.account?.status === 'trialing' || !accountStore.account?.status" @click="startCheckout" :disabled="billingLoading" class="btn-primary">
            Subscribe
          </button>
          <button v-else @click="openPortal" :disabled="billingLoading" class="btn-secondary">
            Manage Subscription
          </button>
        </div>
      </div>
    </div>

    <!-- Instagram Connection -->
    <div class="card">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center">
          <svg viewBox="0 0 24 24" class="w-4 h-4 fill-white">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </div>
        <h2 class="text-base font-semibold text-white">Instagram Connection</h2>
      </div>

      <div v-if="authStore.isAuthenticated && authStore.user" class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-full overflow-hidden bg-accent-500 flex items-center justify-center">
          <img
            v-if="authStore.user.profilePicture"
            :src="authStore.user.profilePicture"
            :alt="authStore.user.username"
            class="w-full h-full object-cover"
            @error="(e) => e.target.style.display = 'none'"
          />
          <span v-else class="text-white font-bold">
            {{ (authStore.user.username || 'U')[0].toUpperCase() }}
          </span>
        </div>
        <div class="flex-1">
          <p class="text-white font-medium">@{{ authStore.user.username }}</p>
          <p class="text-gray-500 text-sm">Connected Instagram Business Account</p>
        </div>
        <button @click="handleDisconnect" class="btn-danger text-sm">
          <ArrowRightOnRectangleIcon class="w-4 h-4" />
          Disconnect
        </button>
      </div>

      <div v-else class="text-center py-4">
        <p class="text-gray-400 text-sm mb-3">No Instagram account connected</p>
        <a href="/auth/instagram" class="btn-primary inline-flex">
          Connect Instagram
        </a>
      </div>
    </div>

    <!-- Content Folder -->
    <div class="card">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-8 h-8 rounded-lg bg-accent-500/15 flex items-center justify-center">
          <FolderIcon class="w-4 h-4 text-accent-400" />
        </div>
        <h2 class="text-base font-semibold text-white">Content Folder</h2>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">Folder Path</label>
          <div class="flex gap-2">
            <input
              v-model="contentFolder"
              type="text"
              placeholder="C:\Users\You\Pictures\instagram"
              class="input-field flex-1"
            />
            <button
              v-if="isElectron"
              @click="browseFolder"
              class="btn-secondary shrink-0"
              title="Pick a folder"
            >
              <FolderIcon class="w-4 h-4" />
              Browse
            </button>
          </div>
          <p class="text-xs text-gray-600 mt-1">
            Full path to the folder containing your Instagram media (JPG, PNG, GIF, MP4, MOV)
          </p>
        </div>
      </div>
    </div>

    <!-- OpenAI -->
    <div class="card">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
          <SparklesIcon class="w-4 h-4 text-green-400" />
        </div>
        <h2 class="text-base font-semibold text-white">OpenAI — AI Captions</h2>
      </div>
      <div>
        <label class="block text-sm text-gray-400 mb-1.5">API Key</label>
        <input
          v-model="openaiKey"
          type="password"
          placeholder="sk-..."
          class="input-field"
          autocomplete="off"
        />
        <p class="text-xs text-gray-600 mt-1">
          Used to generate Instagram captions with GPT-4o.
          Get your key at <a href="https://platform.openai.com/api-keys" target="_blank" class="text-accent-400 hover:underline">platform.openai.com</a>
        </p>
      </div>
    </div>

    <!-- Connections (ngrok) -->
    <div class="card">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <GlobeAltIcon class="w-4 h-4 text-blue-400" />
        </div>
        <h2 class="text-base font-semibold text-white">Connections</h2>
      </div>

      <!-- ngrok status badge -->
      <div class="flex items-center gap-2 mb-4">
        <span
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
          :class="{
            'bg-green-500/15 text-green-400': ngrokStatus === 'connected',
            'bg-yellow-500/15 text-yellow-400': ngrokStatus === 'connecting',
            'bg-red-500/15 text-red-400': ngrokStatus === 'error',
            'bg-gray-500/15 text-gray-400': ngrokStatus === 'disconnected',
          }"
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="{
              'bg-green-400': ngrokStatus === 'connected',
              'bg-yellow-400 animate-pulse': ngrokStatus === 'connecting',
              'bg-red-400': ngrokStatus === 'error',
              'bg-gray-500': ngrokStatus === 'disconnected',
            }"
          />
          <template v-if="ngrokStatus === 'connected'">Connected</template>
          <template v-else-if="ngrokStatus === 'connecting'">Connecting...</template>
          <template v-else-if="ngrokStatus === 'error'">Error</template>
          <template v-else>Disconnected</template>
        </span>
        <span v-if="ngrokStatus === 'error' && ngrokError" class="text-xs text-red-400">{{ ngrokError }}</span>
      </div>

      <!-- Current URL -->
      <div v-if="ngrokUrl" class="mb-4">
        <label class="block text-xs text-gray-500 mb-1">Tunnel URL</label>
        <code
          class="block w-full text-xs text-green-300 bg-white/5 border border-white/10 rounded-lg px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors"
          @click="copyNgrokUrl"
          title="Click to copy"
        >{{ ngrokUrl }}</code>
        <p class="text-xs text-gray-600 mt-1">Click to copy</p>
      </div>

      <!-- Authtoken input -->
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">ngrok Authtoken</label>
          <input
            v-model="ngrokAuthtoken"
            type="password"
            placeholder="Get yours free at ngrok.com/signup"
            class="input-field"
            autocomplete="off"
          />
        </div>
        <button
          @click="saveAndConnectNgrok"
          :disabled="ngrokConnecting"
          class="btn-primary w-full justify-center"
        >
          <svg v-if="ngrokConnecting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <GlobeAltIcon v-else class="w-4 h-4" />
          {{ ngrokConnecting ? 'Connecting...' : 'Save & Connect' }}
        </button>
        <div class="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
          <p class="text-xs text-gray-400">
            ngrok creates a secure tunnel so Instagram can download your media. It starts automatically when Managram opens.
            Get a free authtoken at <a href="https://ngrok.com/signup" target="_blank" class="text-accent-400 hover:underline">ngrok.com/signup</a>.
          </p>
        </div>
      </div>
    </div>

    <!-- App Credentials -->
    <div class="card">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center">
          <KeyIcon class="w-4 h-4 text-gray-300" />
        </div>
        <h2 class="text-base font-semibold text-white">Facebook App Credentials</h2>
      </div>
      <div class="space-y-3">
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">App ID</label>
          <input v-model="appId" type="text" placeholder="Your Facebook App ID" class="input-field" />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1.5">App Secret</label>
          <input v-model="appSecret" type="password" placeholder="Your App Secret" class="input-field" autocomplete="off" />
        </div>
        <p class="text-xs text-gray-600">
          Create an app at <a href="https://developers.facebook.com" target="_blank" class="text-accent-400 hover:underline">developers.facebook.com</a>
        </p>
      </div>
    </div>

    <!-- Save button -->
    <div>
      <button @click="saveSettings" :disabled="saving" class="btn-primary w-full justify-center">
        <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <CheckIcon v-else class="w-4 h-4" />
        {{ saving ? 'Saving...' : 'Save Settings' }}
      </button>
      <p v-if="saveError" class="text-red-400 text-sm mt-2 text-center">{{ saveError }}</p>
      <p v-if="saveSuccess" class="text-green-400 text-sm mt-2 text-center flex items-center justify-center gap-1">
        <CheckCircleIcon class="w-4 h-4" />
        Settings saved successfully
      </p>
    </div>

    <!-- About -->
    <div class="card bg-white/2 border-white/5">
      <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">About</h2>
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center">
          <span class="text-white font-bold">M</span>
        </div>
        <div>
          <p class="text-white font-medium">Managram v1.0.0</p>
          <p class="text-gray-500 text-sm">Instagram Content Manager</p>
        </div>
      </div>
      <p class="text-gray-600 text-xs mt-3">
        A self-hosted Instagram manager with scheduling, AI captions, and media library management.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue';
import axios from 'axios';
import {
  FolderIcon,
  SparklesIcon,
  GlobeAltIcon,
  KeyIcon,
  CheckIcon,
  CreditCardIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/vue/24/outline';
import { CheckCircleIcon } from '@heroicons/vue/24/solid';
import { useAuthStore } from '../stores/auth.js';
import { useSettingsStore } from '../stores/settings.js';
import { useAccountStore } from '../stores/account.js';

const showToast = inject('showToast');
const authStore = useAuthStore();
const settingsStore = useSettingsStore();
const accountStore = useAccountStore();
const billingLoading = ref(false);

async function startCheckout() {
  billingLoading.value = true;
  try {
    const response = await axios.post('/billing/checkout', {});
    window.location.href = response.data.url;
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to start checkout', 'error');
  } finally {
    billingLoading.value = false;
  }
}

async function openPortal() {
  billingLoading.value = true;
  try {
    const response = await axios.get('/billing/portal');
    window.location.href = response.data.url;
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to open billing portal', 'error');
  } finally {
    billingLoading.value = false;
  }
}

const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

const contentFolder = ref('');
const openaiKey = ref('');
const publicUrl = ref('');
const appId = ref('');
const appSecret = ref('');
const saving = ref(false);
const saveError = ref('');
const saveSuccess = ref(false);

// ngrok state
const ngrokAuthtoken = ref('');
const ngrokStatus = ref('disconnected');
const ngrokUrl = ref('');
const ngrokError = ref('');
const ngrokConnecting = ref(false);

async function browseFolder() {
  if (!window.electronAPI) return;
  const picked = await window.electronAPI.selectFolder();
  if (picked) contentFolder.value = picked;
}

function copyNgrokUrl() {
  if (ngrokUrl.value) {
    navigator.clipboard.writeText(ngrokUrl.value).then(() => {
      showToast('URL copied to clipboard', 'success');
    });
  }
}

async function saveAndConnectNgrok() {
  ngrokConnecting.value = true;
  try {
    // Always save the authtoken to backend settings
    if (ngrokAuthtoken.value) {
      await axios.post('/settings', { ngrok_authtoken: ngrokAuthtoken.value });
    }

    if (isElectron && window.electronAPI) {
      const status = await window.electronAPI.restartNgrok(ngrokAuthtoken.value || undefined);
      ngrokStatus.value = status.status;
      ngrokUrl.value = status.url || '';
      ngrokError.value = status.error || '';
    } else {
      showToast('ngrok is managed automatically in the Electron app', 'info');
    }
  } catch (err) {
    ngrokError.value = err.response?.data?.error || err.message;
    showToast(ngrokError.value, 'error');
  } finally {
    ngrokConnecting.value = false;
  }
}

async function loadSettings() {
  await settingsStore.loadSettings();
  contentFolder.value = settingsStore.contentFolder;
  publicUrl.value = settingsStore.publicUrl;
  appId.value = settingsStore.appId;
  // Load raw settings for display of masked keys
  try {
    const response = await axios.get('/settings');
    const s = response.data.settings;
    openaiKey.value = s.openai_api_key || '';
    appSecret.value = s.app_secret || '';
    ngrokAuthtoken.value = s.ngrok_authtoken || '';
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  // Populate ngrok status from Electron if available
  if (isElectron && window.electronAPI) {
    try {
      const status = await window.electronAPI.getNgrokStatus();
      ngrokStatus.value = status.status;
      ngrokUrl.value = status.url || '';
      ngrokError.value = status.error || '';
    } catch (err) {
      console.warn('Failed to get ngrok status:', err);
    }

    // Subscribe to live updates
    window.electronAPI.onNgrokUrl((url) => {
      ngrokStatus.value = 'connected';
      ngrokUrl.value = url;
      ngrokError.value = '';
    });
    window.electronAPI.onNgrokError((msg) => {
      ngrokStatus.value = 'error';
      ngrokError.value = msg;
    });
  }
}

async function saveSettings() {
  saving.value = true;
  saveError.value = '';
  saveSuccess.value = false;

  try {
    const updates = {
      content_folder_path: contentFolder.value,
      public_url: publicUrl.value,
      app_id: appId.value,
    };

    // Only send API keys if they were changed (not masked)
    if (openaiKey.value && !openaiKey.value.includes('••••')) {
      updates.openai_api_key = openaiKey.value;
    }
    if (appSecret.value && !appSecret.value.includes('••••')) {
      updates.app_secret = appSecret.value;
    }

    await axios.post('/settings', updates);
    saveSuccess.value = true;
    showToast('Settings saved successfully', 'success');
    setTimeout(() => { saveSuccess.value = false; }, 3000);
  } catch (err) {
    saveError.value = err.response?.data?.error || 'Failed to save settings';
    showToast(saveError.value, 'error');
  } finally {
    saving.value = false;
  }
}

async function handleDisconnect() {
  await authStore.logout();
  showToast('Disconnected from Instagram', 'info');
}

onMounted(() => {
  loadSettings();
});
</script>
