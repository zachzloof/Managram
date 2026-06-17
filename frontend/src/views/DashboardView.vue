<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">
          Good {{ timeOfDay }},
          <span class="text-gradient">@{{ authStore.user?.username || 'there' }}</span>
        </h1>
        <p class="text-gray-400 text-sm mt-0.5">Here's what's happening with your account</p>
      </div>
      <div class="flex gap-2">
        <RouterLink to="/compose" class="btn-primary">
          <PencilSquareIcon class="w-4 h-4" />
          New Post
        </RouterLink>
        <RouterLink to="/queue" class="btn-secondary">
          <QueueListIcon class="w-4 h-4" />
          View Queue
        </RouterLink>
      </div>
    </div>

    <!-- Stats cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="card group hover:border-white/10 transition-all duration-200">
        <div class="flex items-start justify-between mb-3">
          <div class="w-9 h-9 rounded-md bg-accent-500/10 flex items-center justify-center">
            <UserGroupIcon class="w-5 h-5 text-accent-400" />
          </div>
          <span class="text-xs text-gray-600">Followers</span>
        </div>
        <div class="text-2xl font-bold text-white font-data">
          {{ accountInfo ? formatNumber(accountInfo.followers_count) : '—' }}
        </div>
        <p class="text-xs text-gray-500 mt-0.5">Total followers</p>
      </div>

      <div class="card group hover:border-white/10 transition-all duration-200">
        <div class="flex items-start justify-between mb-3">
          <div class="w-9 h-9 rounded-md bg-white/[0.04] flex items-center justify-center">
            <PhotoIcon class="w-5 h-5 text-gray-300" />
          </div>
          <span class="text-xs text-gray-600">Posts</span>
        </div>
        <div class="text-2xl font-bold text-white font-data">
          {{ accountInfo ? formatNumber(accountInfo.media_count) : '—' }}
        </div>
        <p class="text-xs text-gray-500 mt-0.5">Total posts</p>
      </div>

      <div class="card group hover:border-white/10 transition-all duration-200">
        <div class="flex items-start justify-between mb-3">
          <div class="w-9 h-9 rounded-md bg-emerald-500/10 flex items-center justify-center">
            <QueueListIcon class="w-5 h-5 text-emerald-400" />
          </div>
          <span class="text-xs text-gray-600">Queued</span>
        </div>
        <div class="text-2xl font-bold text-white font-data">{{ queueStore.pendingCount }}</div>
        <p class="text-xs text-gray-500 mt-0.5">Posts in queue</p>
      </div>

      <div class="card group hover:border-white/10 transition-all duration-200">
        <div class="flex items-start justify-between mb-3">
          <div class="w-9 h-9 rounded-md bg-sky-500/10 flex items-center justify-center">
            <ClockIcon class="w-5 h-5 text-sky-400" />
          </div>
          <span class="text-xs text-gray-600">Next Post</span>
        </div>
        <div class="text-xl font-bold text-white truncate font-data">{{ nextScheduledTime || '—' }}</div>
        <p class="text-xs text-gray-500 mt-0.5">Scheduled post</p>
      </div>
    </div>

    <!-- Recent posts grid -->
    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="section-header mb-0">Recent Posts</h2>
        <button
          @click="loadRecentPosts"
          class="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <ArrowPathIcon class="w-4 h-4" :class="loadingPosts ? 'animate-spin' : ''" />
          Refresh
        </button>
      </div>

      <!-- Loading state -->
      <div v-if="loadingPosts" class="grid grid-cols-3 gap-3">
        <div
          v-for="i in 6"
          :key="i"
          class="aspect-square bg-gray-900 rounded-lg animate-pulse border border-white/5"
        />
      </div>

      <!-- Posts grid -->
      <div v-else-if="recentPosts.length > 0" class="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <a
          v-for="post in recentPosts.slice(0, 6)"
          :key="post.id"
          :href="post.permalink"
          target="_blank"
          rel="noopener noreferrer"
          class="relative aspect-square rounded-lg overflow-hidden bg-gray-900 group border border-white/5 hover:border-white/20 transition-all duration-200"
        >
          <img
            :src="post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url"
            :alt="post.caption || 'Instagram post'"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div class="flex items-center gap-3 text-white text-xs font-medium">
              <span class="flex items-center gap-1">
                <HeartIcon class="w-3.5 h-3.5" />
                {{ formatNumber(post.like_count || 0) }}
              </span>
              <span class="flex items-center gap-1">
                <ChatBubbleOvalLeftIcon class="w-3.5 h-3.5" />
                {{ formatNumber(post.comments_count || 0) }}
              </span>
            </div>
          </div>
          <div v-if="post.media_type === 'VIDEO'" class="absolute top-2 left-2">
            <PlayIcon class="w-4 h-4 text-white drop-shadow" />
          </div>
        </a>
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-12">
        <PhotoIcon class="w-12 h-12 text-gray-700 mx-auto mb-3" />
        <p class="text-gray-400 font-medium">No posts yet</p>
        <p class="text-gray-600 text-sm">Your recent Instagram posts will appear here</p>
        <RouterLink to="/compose" class="btn-primary mt-4 inline-flex">
          <PencilSquareIcon class="w-4 h-4" />
          Create First Post
        </RouterLink>
      </div>
    </div>

    <!-- Quick actions -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <RouterLink
        to="/library"
        class="card hover:border-white/10 transition-all duration-200 group cursor-pointer flex items-center gap-3"
      >
        <div class="w-10 h-10 rounded-md bg-accent-500 flex items-center justify-center shrink-0">
          <PhotoIcon class="w-5 h-5 text-white" />
        </div>
        <div>
          <p class="text-white font-medium group-hover:text-gradient transition-all duration-200">Media Library</p>
          <p class="text-gray-500 text-sm">Browse your files</p>
        </div>
        <ArrowRightIcon class="w-4 h-4 text-gray-600 ml-auto group-hover:text-white transition-colors" />
      </RouterLink>

      <RouterLink
        to="/schedule"
        class="card hover:border-white/10 transition-all duration-200 group cursor-pointer flex items-center gap-3"
      >
        <div class="w-10 h-10 rounded-md bg-accent-500 flex items-center justify-center shrink-0">
          <CalendarDaysIcon class="w-5 h-5 text-white" />
        </div>
        <div>
          <p class="text-white font-medium group-hover:text-gradient transition-all duration-200">Schedules</p>
          <p class="text-gray-500 text-sm">Auto-post times</p>
        </div>
        <ArrowRightIcon class="w-4 h-4 text-gray-600 ml-auto group-hover:text-white transition-colors" />
      </RouterLink>

      <RouterLink
        to="/settings"
        class="card hover:border-white/10 transition-all duration-200 group cursor-pointer flex items-center gap-3"
      >
        <div class="w-10 h-10 rounded-md bg-accent-500 flex items-center justify-center shrink-0">
          <CogIcon class="w-5 h-5 text-white" />
        </div>
        <div>
          <p class="text-white font-medium group-hover:text-gradient transition-all duration-200">Settings</p>
          <p class="text-gray-500 text-sm">Configure the app</p>
        </div>
        <ArrowRightIcon class="w-4 h-4 text-gray-600 ml-auto group-hover:text-white transition-colors" />
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import axios from 'axios';
import {
  UserGroupIcon,
  PhotoIcon,
  QueueListIcon,
  ClockIcon,
  PencilSquareIcon,
  CalendarDaysIcon,
  CogIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  HeartIcon,
  ChatBubbleOvalLeftIcon,
  PlayIcon,
} from '@heroicons/vue/24/outline';
import { useAuthStore } from '../stores/auth.js';
import { useQueueStore } from '../stores/queue.js';

const authStore = useAuthStore();
const queueStore = useQueueStore();

const recentPosts = ref([]);
const accountInfo = ref(null);
const loadingPosts = ref(false);
const nextScheduledTime = ref(null);

const timeOfDay = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
});

function formatNumber(num) {
  if (!num && num !== 0) return '0';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

async function loadAccountInfo() {
  try {
    const response = await axios.get('/posts/account');
    accountInfo.value = response.data.account;
  } catch (err) {
    console.error('Failed to load account info:', err);
  }
}

async function loadRecentPosts() {
  loadingPosts.value = true;
  try {
    const response = await axios.get('/posts/recent?limit=6');
    recentPosts.value = response.data.posts || [];
  } catch (err) {
    console.error('Failed to load recent posts:', err);
  } finally {
    loadingPosts.value = false;
  }
}

async function loadNextSchedule() {
  try {
    const response = await axios.get('/schedule');
    const schedules = response.data.schedules || [];
    const activeWithNext = schedules
      .filter((s) => s.active && s.nextFireTime)
      .sort((a, b) => new Date(a.nextFireTime) - new Date(b.nextFireTime));

    if (activeWithNext.length > 0) {
      const next = new Date(activeWithNext[0].nextFireTime);
      const now = new Date();
      const diff = next - now;

      if (diff < 3600000) {
        nextScheduledTime.value = `in ${Math.floor(diff / 60000)}m`;
      } else if (diff < 86400000) {
        nextScheduledTime.value = `in ${Math.floor(diff / 3600000)}h`;
      } else {
        nextScheduledTime.value = next.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
      }
    }
  } catch (err) {
    console.error('Failed to load schedules:', err);
  }
}

onMounted(() => {
  queueStore.loadQueue();
  loadRecentPosts();
  loadAccountInfo();
  loadNextSchedule();
});
</script>
