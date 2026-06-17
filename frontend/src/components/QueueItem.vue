<template>
  <div class="flex items-start gap-4 p-4 bg-gray-900 border border-white/5 rounded-xl hover:border-white/10 transition-all duration-200 animate-fade-in">
    <!-- Thumbnail -->
    <div class="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 shrink-0">
      <img
        v-if="item.media_type === 'IMAGE'"
        :src="`/media/file/${encodeURIComponent(getFilename(item.media_path))}`"
        :alt="getFilename(item.media_path)"
        class="w-full h-full object-cover"
        @error="onImgError"
      />
      <div v-else class="w-full h-full flex items-center justify-center">
        <VideoCameraIcon class="w-6 h-6 text-gray-600" />
      </div>
      <div v-if="imgError" class="w-full h-full flex items-center justify-center">
        <PhotoIcon class="w-6 h-6 text-gray-600" />
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <!-- Top row: filename + status -->
      <div class="flex items-center gap-2 mb-1">
        <p class="text-white text-sm font-medium truncate">{{ getFilename(item.media_path) }}</p>
        <span
          class="shrink-0"
          :class="{
            'badge-pending': item.status === 'pending',
            'badge-posted': item.status === 'posted',
            'badge-failed': item.status === 'failed',
            'badge-posting': item.status === 'posting',
            'bg-blue-500/20 text-blue-400 border border-blue-500/30 badge': item.status === 'scheduled',
          }"
        >
          {{ item.status }}
        </span>
      </div>

      <!-- Error message (failed items) -->
      <p v-if="item.status === 'failed' && item.error_message" class="text-red-400 text-xs mb-1.5 line-clamp-2">
        {{ item.error_message }}
      </p>

      <!-- Caption preview -->
      <p v-if="item.caption" class="text-gray-400 text-sm line-clamp-2 mb-1.5">{{ item.caption }}</p>
      <p v-else class="text-gray-600 text-sm italic mb-1.5">No caption</p>

      <!-- Meta info -->
      <div class="flex items-center gap-3 text-xs text-gray-500">
        <span v-if="item.scheduled_at" class="flex items-center gap-1">
          <ClockIcon class="w-3 h-3" />
          {{ formatDate(item.scheduled_at) }}
        </span>
        <span v-if="item.posted_at" class="flex items-center gap-1 text-green-500">
          <CheckCircleIcon class="w-3 h-3" />
          Posted {{ formatDate(item.posted_at) }}
        </span>
        <span class="flex items-center gap-1">
          <CalendarIcon class="w-3 h-3" />
          Added {{ formatDate(item.created_at) }}
        </span>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1 shrink-0">
      <button
        v-if="item.status === 'pending' || item.status === 'failed'"
        @click="$emit('postNow', item)"
        class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-accent-500 transition-all duration-200"
        title="Post Now"
      >
        <BoltIcon class="w-4 h-4" />
      </button>
      <button
        v-if="item.status === 'pending'"
        @click="$emit('edit', item)"
        class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
        title="Edit"
      >
        <PencilIcon class="w-4 h-4" />
      </button>
      <button
        @click="$emit('remove', item)"
        class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        title="Remove"
      >
        <TrashIcon class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  VideoCameraIcon,
  PhotoIcon,
  ClockIcon,
  CheckCircleIcon,
  CalendarIcon,
  BoltIcon,
  PencilIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
});

defineEmits(['postNow', 'edit', 'remove']);

const imgError = ref(false);

function onImgError() {
  imgError.value = true;
}

function getFilename(filePath) {
  if (!filePath) return 'Unknown';
  return filePath.split(/[/\\]/).pop();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z');
    const now = new Date();
    const diff = now - date;

    if (diff < 0) {
      const abs = -diff;
      if (abs < 60000) return 'in less than a minute';
      if (abs < 3600000) return `in ${Math.floor(abs / 60000)}m`;
      if (abs < 86400000) return `in ${Math.floor(abs / 3600000)}h`;
      return `in ${Math.floor(abs / 86400000)}d`;
    }

    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}
</script>
