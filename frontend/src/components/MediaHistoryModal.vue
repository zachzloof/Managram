<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="bg-gray-900 border border-white/10 rounded-lg w-full max-w-lg shadow-2xl max-h-[80vh] flex flex-col">
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <h3 class="text-base font-semibold text-white">Post History</h3>
            <p class="text-gray-500 text-xs truncate max-w-xs">{{ file.name }}</p>
          </div>
          <button @click="$emit('close')" class="w-8 h-8 rounded-md bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
            <XMarkIcon class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-5 space-y-4">
          <div v-if="loading" class="text-center py-10 text-gray-500 text-sm">Loading…</div>

          <template v-else>
            <div v-if="!contentId" class="text-center py-10">
              <p class="text-gray-400 text-sm">This file type isn't tracked for repost history.</p>
            </div>
            <div v-else-if="history.length === 0" class="text-center py-10">
              <p class="text-gray-400 text-sm">Never posted yet.</p>
              <p class="text-gray-600 text-xs mt-1">Post it to start tracking performance here.</p>
            </div>
            <template v-else>
              <div class="card bg-white/[0.02]">
                <p class="text-xs text-gray-500">
                  Posted <span class="text-white font-data">{{ history.length }}</span> time{{ history.length > 1 ? 's' : '' }}
                </p>
              </div>
              <div
                v-for="h in history"
                :key="h.id"
                class="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/5"
              >
                <div class="w-8 h-8 rounded-md bg-accent-500/10 flex items-center justify-center shrink-0">
                  <ClockIcon class="w-4 h-4 text-accent-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-white text-sm">{{ formatDate(h.posted_at) }}</p>
                  <p v-if="h.caption" class="text-gray-500 text-xs truncate mt-0.5">{{ h.caption }}</p>
                  <div class="flex items-center gap-3 mt-1.5 text-xs">
                    <span v-if="h.metrics" class="flex items-center gap-1 text-gray-300">
                      <HeartIcon class="w-3 h-3" /> {{ h.metrics.like_count ?? '—' }}
                    </span>
                    <span v-if="h.metrics" class="flex items-center gap-1 text-gray-300">
                      <ChatBubbleOvalLeftIcon class="w-3 h-3" /> {{ h.metrics.comments_count ?? '—' }}
                    </span>
                    <span v-else class="text-gray-600">No engagement data yet</span>
                  </div>
                </div>
              </div>
            </template>

            <div v-if="tags.length > 0">
              <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tags</p>
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="tag in tags"
                  :key="tag.id"
                  class="px-2 py-0.5 rounded text-xs font-medium"
                  :style="{ backgroundColor: tag.color + '26', color: tag.color, border: `1px solid ${tag.color}40` }"
                >
                  {{ tag.name }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { XMarkIcon, ClockIcon, HeartIcon, ChatBubbleOvalLeftIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  file: { type: Object, required: true },
});

defineEmits(['close']);

const loading = ref(true);
const contentId = ref(null);
const tags = ref([]);
const history = ref([]);

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
    const now = new Date();
    const diffDays = Math.floor((now - date) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

onMounted(async () => {
  try {
    const response = await axios.get('/media/identity', { params: { subpath: props.file.subpath } });
    contentId.value = response.data.contentId;
    tags.value = response.data.tags || [];
    history.value = response.data.history || [];
  } catch (err) {
    console.error('Failed to load history:', err.message);
  } finally {
    loading.value = false;
  }
});
</script>
