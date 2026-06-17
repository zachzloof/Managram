<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Analytics</h1>
        <p class="text-gray-400 text-sm mt-0.5">How your recent content has performed, and what's trending</p>
      </div>
      <button @click="loadAll" class="btn-secondary">
        <ArrowPathIcon class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
    </div>

    <div v-if="loading && !overview" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="h-28 bg-gray-900 rounded-lg animate-pulse border border-white/5" />
    </div>

    <template v-else-if="overview">
      <!-- Stat cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card">
          <p class="text-xs text-gray-500 mb-2">Posts Tracked</p>
          <p class="text-2xl font-bold text-white font-data">{{ overview.totalPosts }}</p>
        </div>
        <div class="card">
          <p class="text-xs text-gray-500 mb-2">Avg. Likes</p>
          <p class="text-2xl font-bold text-white font-data">{{ formatNum(overview.avgLikes) }}</p>
        </div>
        <div class="card">
          <p class="text-xs text-gray-500 mb-2">Avg. Comments</p>
          <p class="text-2xl font-bold text-white font-data">{{ formatNum(overview.avgComments) }}</p>
        </div>
        <div class="card">
          <p class="text-xs text-gray-500 mb-2">Best Time to Post</p>
          <p v-if="overview.bestTimes.length" class="text-2xl font-bold text-accent-400 font-data">{{ overview.bestTimes[0].label }}</p>
          <p v-else class="text-sm text-gray-600">Not enough data yet</p>
        </div>
      </div>

      <!-- Best / worst performer -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div v-if="overview.best" class="card">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Top Performer</p>
          <p class="text-white text-sm truncate">{{ overview.best.caption || overview.best.subpath_at_post_time }}</p>
          <div class="flex items-center gap-4 mt-2 text-sm text-gray-300">
            <span class="flex items-center gap-1"><HeartIcon class="w-4 h-4 text-accent-400" /> {{ overview.best.like_count ?? 0 }}</span>
            <span class="flex items-center gap-1"><ChatBubbleOvalLeftIcon class="w-4 h-4 text-accent-400" /> {{ overview.best.comments_count ?? 0 }}</span>
            <span class="text-gray-600 text-xs">{{ formatRelative(overview.best.posted_at) }}</span>
          </div>
        </div>
        <div v-if="overview.worst && overview.worst.id !== overview.best?.id" class="card">
          <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Lowest Performer</p>
          <p class="text-white text-sm truncate">{{ overview.worst.caption || overview.worst.subpath_at_post_time }}</p>
          <div class="flex items-center gap-4 mt-2 text-sm text-gray-300">
            <span class="flex items-center gap-1"><HeartIcon class="w-4 h-4 text-gray-500" /> {{ overview.worst.like_count ?? 0 }}</span>
            <span class="flex items-center gap-1"><ChatBubbleOvalLeftIcon class="w-4 h-4 text-gray-500" /> {{ overview.worst.comments_count ?? 0 }}</span>
            <span class="text-gray-600 text-xs">{{ formatRelative(overview.worst.posted_at) }}</span>
          </div>
        </div>
      </div>

      <!-- Follower growth -->
      <div class="card">
        <p class="section-header">Follower Growth</p>
        <div v-if="followerChartData" class="h-56">
          <Line :data="followerChartData" :options="lineOptions" />
        </div>
        <p v-else class="text-gray-500 text-sm">Not enough history yet — check back after a few days of tracking.</p>
      </div>

      <!-- Tag performance -->
      <div class="card">
        <p class="section-header">Performance by Tag</p>
        <div v-if="tagChartData" class="h-56">
          <Bar :data="tagChartData" :options="barOptions" />
        </div>
        <p v-else class="text-gray-500 text-sm">Tag some posted content to see which themes perform best.</p>
      </div>

      <!-- Recent posts -->
      <div class="card">
        <p class="section-header">Recent Posts</p>
        <div v-if="posts.length === 0" class="text-gray-500 text-sm">No tracked posts yet — published posts will show up here.</div>
        <div v-else class="space-y-2">
          <div
            v-for="p in posts"
            :key="p.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5"
          >
            <div class="w-8 h-8 rounded-md bg-white/[0.04] flex items-center justify-center shrink-0">
              <VideoCameraIcon v-if="p.mediaType === 'VIDEO'" class="w-4 h-4 text-gray-400" />
              <PhotoIcon v-else class="w-4 h-4 text-gray-400" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white text-sm truncate">{{ p.caption || p.subpath }}</p>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  v-for="tag in p.tags"
                  :key="tag.id"
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  :style="{ backgroundColor: tag.color + '26', color: tag.color }"
                >{{ tag.name }}</span>
              </div>
            </div>
            <div class="flex items-center gap-3 text-xs text-gray-400 shrink-0">
              <span class="flex items-center gap-1"><HeartIcon class="w-3.5 h-3.5" /> {{ p.likeCount ?? '—' }}</span>
              <span class="flex items-center gap-1"><ChatBubbleOvalLeftIcon class="w-3.5 h-3.5" /> {{ p.commentsCount ?? '—' }}</span>
              <span class="text-gray-600 w-16 text-right">{{ formatRelative(p.postedAt) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';
import { ArrowPathIcon, HeartIcon, ChatBubbleOvalLeftIcon, PhotoIcon, VideoCameraIcon } from '@heroicons/vue/24/outline';
import { Line, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
} from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement);

const loading = ref(false);
const overview = ref(null);
const posts = ref([]);
const tags = ref([]);

function formatNum(n) {
  if (!n) return '0';
  return n >= 1000 ? (n / 1000).toFixed(1) + 'K' : Math.round(n).toString();
}

function formatRelative(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
    const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000);
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return '1d ago';
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

const followerChartData = computed(() => {
  const growth = overview.value?.followerGrowth || [];
  if (growth.length < 2) return null;
  return {
    labels: growth.map((g) => new Date(g.fetchedAt.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: 'Followers',
        data: growth.map((g) => g.followers),
        borderColor: '#ff7e29',
        backgroundColor: 'rgba(255,126,41,0.15)',
        tension: 0.3,
        fill: true,
      },
    ],
  };
});

const tagChartData = computed(() => {
  if (!tags.value.length) return null;
  return {
    labels: tags.value.map((t) => t.name),
    datasets: [
      {
        label: 'Avg. Likes',
        data: tags.value.map((t) => Math.round(t.avgLikes)),
        backgroundColor: tags.value.map((t) => t.color),
        borderRadius: 4,
      },
    ],
  };
});

const chartTextColor = '#9a9a9a';
const chartGridColor = 'rgba(255,255,255,0.06)';

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } },
    y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } },
  },
};

const barOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { ticks: { color: chartTextColor }, grid: { display: false } },
    y: { ticks: { color: chartTextColor }, grid: { color: chartGridColor } },
  },
};

async function loadAll() {
  loading.value = true;
  try {
    const [overviewRes, postsRes, tagsRes] = await Promise.all([
      axios.get('/analytics/overview'),
      axios.get('/analytics/posts', { params: { limit: 20 } }),
      axios.get('/analytics/tags'),
    ]);
    overview.value = overviewRes.data;
    posts.value = postsRes.data.posts;
    tags.value = tagsRes.data.tags;
  } catch (err) {
    console.error('Failed to load analytics:', err.message);
  } finally {
    loading.value = false;
  }
}

onMounted(loadAll);
</script>
