<template>
  <div
    class="group relative rounded-xl overflow-hidden bg-gray-800 border border-white/5
           hover:border-white/20 transition-all duration-200 cursor-pointer aspect-square"
    @click="$emit('select', file)"
  >
    <!-- Image -->
    <img
      v-if="file.type === 'image'"
      :src="file.url"
      :alt="file.name"
      class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      loading="lazy"
      @error="onLoadError"
    />

    <!-- Video placeholder -->
    <div
      v-else
      class="w-full h-full bg-gray-800 flex items-center justify-center"
    >
      <div class="text-center">
        <VideoCameraIcon class="w-10 h-10 text-gray-600 mx-auto mb-1" />
        <p class="text-gray-600 text-xs">{{ file.name }}</p>
      </div>
    </div>

    <!-- Error state -->
    <div
      v-if="loadError"
      class="absolute inset-0 bg-gray-800 flex items-center justify-center"
    >
      <div class="text-center">
        <PhotoIcon class="w-8 h-8 text-gray-600 mx-auto mb-1" />
        <p class="text-gray-600 text-xs">{{ file.name }}</p>
      </div>
    </div>

    <!-- Video badge -->
    <div
      v-if="file.type === 'video'"
      class="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-medium flex items-center gap-1"
    >
      <PlayIcon class="w-3 h-3" />
      VIDEO
    </div>

    <!-- Hover overlay -->
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100
             transition-all duration-200 flex flex-col items-center justify-center gap-2 p-3"
    >
      <p class="text-white text-xs font-medium text-center truncate w-full px-2">{{ file.name }}</p>
      <p class="text-gray-400 text-xs">{{ file.sizeFormatted }}</p>
      <div class="flex gap-2 mt-1">
        <button
          v-if="showPostNow"
          @click.stop="$emit('postNow', file)"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-instagram-gradient text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <BoltIcon class="w-3 h-3" />
          Post Now
        </button>
        <button
          v-if="showQueue"
          @click.stop="$emit('addToQueue', file)"
          class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors"
        >
          <QueueListIcon class="w-3 h-3" />
          Queue
        </button>
      </div>
    </div>

    <!-- Selected indicator -->
    <div
      v-if="selected"
      class="absolute inset-0 border-2 border-pink-500 rounded-xl pointer-events-none"
    >
      <div class="absolute top-2 right-2 w-5 h-5 rounded-full bg-instagram-gradient flex items-center justify-center">
        <CheckIcon class="w-3 h-3 text-white" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import {
  PhotoIcon,
  VideoCameraIcon,
  PlayIcon,
  BoltIcon,
  QueueListIcon,
  CheckIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  file: {
    type: Object,
    required: true,
  },
  selected: {
    type: Boolean,
    default: false,
  },
  showPostNow: {
    type: Boolean,
    default: true,
  },
  showQueue: {
    type: Boolean,
    default: true,
  },
});

defineEmits(['select', 'postNow', 'addToQueue']);

const loadError = ref(false);

function onLoadError() {
  loadError.value = true;
}
</script>
