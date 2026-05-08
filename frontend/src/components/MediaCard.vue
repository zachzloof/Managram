<template>
  <div
    class="group relative rounded-xl overflow-hidden bg-gray-800 border transition-all duration-200 cursor-pointer aspect-square"
    :class="selected ? 'border-pink-500' : 'border-white/5 hover:border-white/20'"
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

    <!-- Video placeholder (no preloading) -->
    <div v-else class="w-full h-full bg-gray-900 flex items-center justify-center">
      <div class="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
        <PlayIcon class="w-7 h-7 text-white ml-1" />
      </div>
    </div>

    <!-- Error state -->
    <div v-if="loadError" class="absolute inset-0 bg-gray-800 flex items-center justify-center">
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

    <!-- Checkbox (top-right, visible on hover or when selected) -->
    <div
      class="absolute top-2 right-2 z-10 transition-opacity duration-150"
      :class="selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
      @click.stop="$emit('toggle', file)"
    >
      <div
        class="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
        :class="selected
          ? 'bg-pink-500 border-pink-500'
          : 'bg-black/50 border-white/60 hover:border-white'"
      >
        <CheckIcon v-if="selected" class="w-3 h-3 text-white" />
      </div>
    </div>

    <!-- Hover overlay -->
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100
             transition-all duration-200 flex flex-col items-center justify-center gap-2 p-3"
    >
      <!-- Filename with rename pencil -->
      <div v-if="!renaming" class="flex items-center gap-1 w-full px-2 justify-center">
        <p class="text-white text-xs font-medium text-center truncate">{{ file.name }}</p>
        <button
          @click.stop="startRename"
          class="shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-white/20 transition-colors"
          title="Rename"
        >
          <PencilIcon class="w-3 h-3 text-gray-300" />
        </button>
      </div>
      <!-- Inline rename input -->
      <div v-else class="flex items-center gap-1 w-full px-2" @click.stop>
        <input
          ref="renameInput"
          v-model="renameValue"
          class="flex-1 bg-white/10 border border-white/30 rounded px-1.5 py-0.5 text-white text-xs outline-none focus:border-white/60 min-w-0"
          @keydown.enter="submitRename"
          @keydown.escape="cancelRename"
        />
        <button @click.stop="submitRename" class="shrink-0 text-green-400 hover:text-green-300 transition-colors">
          <CheckIcon class="w-3.5 h-3.5" />
        </button>
        <button @click.stop="cancelRename" class="shrink-0 text-gray-400 hover:text-white transition-colors">
          <XMarkIcon class="w-3.5 h-3.5" />
        </button>
      </div>
      <p class="text-gray-400 text-xs">{{ file.sizeFormatted }}</p>
      <div class="flex gap-1.5 mt-1 flex-wrap justify-center">
        <button
          v-if="file.type === 'video'"
          @click.stop="$emit('preview', file)"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors"
        >
          <PlayIcon class="w-3 h-3" />
          Preview
        </button>
        <button
          v-if="showPostNow"
          @click.stop="$emit('postNow', file)"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-instagram-gradient text-white text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <BoltIcon class="w-3 h-3" />
          Post
        </button>
        <button
          v-if="showQueue"
          @click.stop="$emit('addToQueue', file)"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors"
        >
          <QueueListIcon class="w-3 h-3" />
          Queue
        </button>
        <button
          @click.stop="$emit('sendTo', file)"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors"
        >
          <FolderArrowDownIcon class="w-3 h-3" />
          Send to
        </button>
        <button
          @click.stop="$emit('delete', file)"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors"
        >
          <TrashIcon class="w-3 h-3" />
          Delete
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue';
import axios from 'axios';
import {
  PhotoIcon,
  PlayIcon,
  BoltIcon,
  QueueListIcon,
  CheckIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon,
  FolderArrowDownIcon,
} from '@heroicons/vue/24/outline';

const props = defineProps({
  file: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  showPostNow: { type: Boolean, default: true },
  showQueue: { type: Boolean, default: true },
});

const emit = defineEmits(['select', 'toggle', 'postNow', 'addToQueue', 'preview', 'renamed', 'delete', 'sendTo']);

const loadError = ref(false);
const renaming = ref(false);
const renameValue = ref('');
const renameInput = ref(null);

function onLoadError() {
  loadError.value = true;
}

function getExt(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i) : '';
}

async function startRename() {
  const ext = getExt(props.file.name);
  renameValue.value = ext ? props.file.name.slice(0, -ext.length) : props.file.name;
  renaming.value = true;
  await nextTick();
  renameInput.value?.focus();
  renameInput.value?.select();
}

function cancelRename() {
  renaming.value = false;
}

async function submitRename() {
  const baseName = renameValue.value.trim();
  const ext = getExt(props.file.name);
  const newName = baseName + ext;
  if (!baseName || newName === props.file.name) {
    cancelRename();
    return;
  }
  try {
    const response = await axios.patch('/media/rename', { filePath: props.file.path, newName });
    emit('renamed', { file: props.file, newName, newPath: response.data.newPath });
    renaming.value = false;
  } catch (err) {
    alert(err.response?.data?.error || 'Rename failed');
  }
}
</script>
