<template>
  <div class="min-h-screen bg-gray-950 text-white">
    <!-- Auth loading state -->
    <div v-if="authStore.loading && !authStore.checked" class="flex items-center justify-center min-h-screen">
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-instagram-gradient flex items-center justify-center animate-pulse">
          <span class="text-white text-xl font-bold">M</span>
        </div>
        <div class="text-gray-400 text-sm">Loading Managram...</div>
      </div>
    </div>

    <!-- Not authenticated — show login -->
    <template v-else-if="!authStore.isAuthenticated">
      <LoginView />
    </template>

    <!-- Authenticated — show full app -->
    <template v-else>
      <div class="flex h-screen overflow-hidden">
        <AppSidebar />
        <main class="flex-1 overflow-y-auto bg-gray-950">
          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in">
              <component :is="Component" :key="$route.path" />
            </Transition>
          </RouterView>
        </main>
      </div>
    </template>

    <!-- Toast notifications -->
    <Teleport to="body">
      <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <TransitionGroup name="toast">
          <div
            v-for="toast in toasts"
            :key="toast.id"
            class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm"
            :class="{
              'bg-green-500/20 border border-green-500/30 text-green-300': toast.type === 'success',
              'bg-red-500/20 border border-red-500/30 text-red-300': toast.type === 'error',
              'bg-blue-500/20 border border-blue-500/30 text-blue-300': toast.type === 'info',
            }"
          >
            <CheckCircleIcon v-if="toast.type === 'success'" class="w-4 h-4 shrink-0" />
            <XCircleIcon v-else-if="toast.type === 'error'" class="w-4 h-4 shrink-0" />
            <InformationCircleIcon v-else class="w-4 h-4 shrink-0" />
            <span>{{ toast.message }}</span>
          </div>
        </TransitionGroup>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { onMounted, ref, provide } from 'vue';
import { RouterView, useRouter, useRoute } from 'vue-router';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon } from '@heroicons/vue/24/solid';
import { useAuthStore } from './stores/auth.js';
import AppSidebar from './components/AppSidebar.vue';
import LoginView from './views/LoginView.vue';

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

const toasts = ref([]);
let toastId = 0;

function showToast(message, type = 'info', duration = 4000) {
  const id = ++toastId;
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, duration);
}

provide('showToast', showToast);

onMounted(async () => {
  await authStore.checkAuth();

  // Handle OAuth callback parameters
  const urlParams = new URLSearchParams(window.location.search);
  const authSuccess = urlParams.get('auth');
  const error = urlParams.get('error');

  if (authSuccess === 'success') {
    // Re-check auth status after successful OAuth
    await authStore.checkAuth();
    // Clean up URL
    window.history.replaceState({}, document.title, '/');
    showToast('Successfully connected to Instagram!', 'success');
  } else if (error) {
    showToast(`Authentication error: ${decodeURIComponent(error)}`, 'error', 8000);
    window.history.replaceState({}, document.title, '/');
  }
});
</script>

<style>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.toast-enter-active {
  transition: all 0.3s ease-out;
}

.toast-leave-active {
  transition: all 0.25s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
