<template>
  <div class="min-h-screen bg-gray-950 flex items-center justify-center p-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-500 mb-4">
          <span class="text-white text-2xl font-bold font-data">M</span>
        </div>
        <h1 class="text-2xl font-bold text-white mb-1">Managram</h1>
        <p class="text-gray-400 text-sm">{{ mode === 'signup' ? 'Start your 7-day free trial' : 'Sign in to your account' }}</p>
      </div>

      <div class="card space-y-3">
        <input v-model="email" type="email" placeholder="Email" class="input-field" @keydown.enter="submit" />
        <input v-model="password" type="password" placeholder="Password" class="input-field" @keydown.enter="submit" />
        <p v-if="error" class="text-red-400 text-xs">{{ error }}</p>
        <button @click="submit" :disabled="loading || !email || !password" class="btn-primary w-full justify-center">
          {{ loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in' }}
        </button>
      </div>

      <button @click="mode = mode === 'signup' ? 'login' : 'signup'" class="block w-full text-center text-gray-500 hover:text-white text-xs mt-4 transition-colors">
        {{ mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Start a free trial" }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAccountStore } from '../stores/account.js';

const accountStore = useAccountStore();
const mode = ref('signup');
const email = ref('');
const password = ref('');
const loading = ref(false);
const error = ref('');

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    if (mode.value === 'signup') {
      await accountStore.signup(email.value, password.value);
    } else {
      await accountStore.login(email.value, password.value);
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Something went wrong';
  } finally {
    loading.value = false;
  }
}
</script>
