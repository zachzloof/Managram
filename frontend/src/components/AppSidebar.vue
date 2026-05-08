<template>
  <aside class="w-64 shrink-0 h-screen bg-gray-900 border-r border-white/5 flex flex-col">
    <!-- Logo -->
    <div class="p-5 border-b border-white/5">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-instagram-gradient flex items-center justify-center shadow-glow-pink shrink-0">
          <span class="text-white text-base font-bold">M</span>
        </div>
        <div>
          <h1 class="text-white font-bold text-base leading-none">Managram</h1>
          <p class="text-gray-500 text-xs mt-0.5">Instagram Manager</p>
        </div>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-3 space-y-0.5 overflow-y-auto">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-item group"
        :class="{ active: isActive(item.to) }"
      >
        <div
          class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200"
          :class="isActive(item.to)
            ? 'bg-instagram-gradient shadow-glow-pink'
            : 'bg-white/5 group-hover:bg-white/10'"
        >
          <component :is="item.icon" class="w-4 h-4" />
        </div>
        <span>{{ item.label }}</span>
        <span
          v-if="item.badge"
          class="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30"
        >
          {{ item.badge }}
        </span>
      </RouterLink>
    </nav>

    <!-- Account info at bottom -->
    <div class="p-3 border-t border-white/5">
      <div class="flex items-center gap-3 px-2 py-2">
        <!-- Avatar -->
        <div class="w-8 h-8 rounded-full overflow-hidden shrink-0 bg-instagram-gradient flex items-center justify-center">
          <img
            v-if="authStore.user?.profilePicture"
            :src="authStore.user.profilePicture"
            :alt="authStore.user.username"
            class="w-full h-full object-cover"
            @error="onAvatarError"
          />
          <span v-else class="text-white text-sm font-bold">
            {{ (authStore.user?.username || 'U')[0].toUpperCase() }}
          </span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-white text-sm font-medium truncate">
            @{{ authStore.user?.username || 'Connected' }}
          </p>
          <p class="text-gray-500 text-xs">Instagram</p>
        </div>
        <button
          @click="handleLogout"
          class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          title="Disconnect Instagram"
        >
          <ArrowRightOnRectangleIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import {
  HomeIcon,
  PhotoIcon,
  PencilSquareIcon,
  QueueListIcon,
  CalendarDaysIcon,
  CogIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '../stores/auth.js';
import { useQueueStore } from '../stores/queue.js';

const authStore = useAuthStore();
const queueStore = useQueueStore();
const route = useRoute();
const router = useRouter();

const showAvatar = ref(true);

function onAvatarError() {
  showAvatar.value = false;
}

function isActive(path) {
  if (path === '/') return route.path === '/';
  return route.path.startsWith(path);
}

const navItems = computed(() => [
  { to: '/', label: 'Dashboard', icon: HomeIcon },
  { to: '/library', label: 'Library', icon: PhotoIcon },
  { to: '/compose', label: 'Compose', icon: PencilSquareIcon },
  {
    to: '/queue',
    label: 'Queue',
    icon: QueueListIcon,
    badge: queueStore.pendingCount > 0 ? queueStore.pendingCount : null,
  },
  { to: '/schedule', label: 'Schedule', icon: CalendarDaysIcon },
  { to: '/settings', label: 'Settings', icon: CogIcon },
]);

async function handleLogout() {
  await authStore.logout();
  router.push('/');
}
</script>
