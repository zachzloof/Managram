<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-500 mb-4">
          <span class="text-white text-2xl font-bold font-data">M</span>
        </div>
        <h1 class="text-2xl font-bold text-white mb-1">Sign in to Managram</h1>
        <p class="text-gray-400 text-sm">{{ statusMessage }}</p>
      </div>

      <div class="card space-y-3">
        <input v-model="email" type="email" placeholder="Email" class="input-field" @keydown.enter="submit" />
        <input v-model="password" type="password" placeholder="Password" class="input-field" @keydown.enter="submit" />
        <p v-if="error" class="text-red-400 text-xs">{{ error }}</p>
        <button @click="submit" :disabled="loading || !email || !password" class="btn-primary w-full justify-center">
          {{ loading ? 'Signing in…' : 'Sign in' }}
        </button>
      </div>
      <p class="text-center text-gray-600 text-xs mt-4">
        No account yet? Subscribe at managram.uk to get your login.
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const emit = defineEmits(['unlocked']);

const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');
const initialState = ref(null);

const statusMessage = ref('Even local installs check in periodically so access can be managed centrally.');

onMounted(async () => {
  const status = await window.electronAPI?.getLicenseStatus();
  initialState.value = status?.state;
  if (status?.state === 'expired') {
    statusMessage.value = 'Your session expired — please sign in again to keep using Managram offline.';
  } else if (status?.state === 'denied') {
    statusMessage.value = 'Access has been disabled for this account. Contact support if this seems wrong.';
  } else if (status?.state === 'clock_rollback') {
    statusMessage.value = 'Your system clock looks like it was set backward — please sign in again.';
  }
});

async function submit() {
  if (!email.value || !password.value) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await window.electronAPI.licenseLogin(email.value, password.value);
    if (result.state === 'valid') {
      emit('unlocked');
    } else {
      error.value = result.error || 'Sign-in failed — check your email and password.';
    }
  } catch (err) {
    error.value = err.message || 'Sign-in failed';
  } finally {
    loading.value = false;
  }
}
</script>
