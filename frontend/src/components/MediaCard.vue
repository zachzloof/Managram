<template>
  <div
    class="relative rounded-xl overflow-hidden bg-gray-800 border transition-all duration-200 cursor-pointer aspect-square"
    :class="selected ? 'border-pink-500' : isHovered ? 'border-white/20' : 'border-white/5'"
    @click="$emit('select', file)"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- Image -->
    <img
      v-if="file.type === 'image'"
      :src="file.url"
      :alt="file.name"
      class="w-full h-full object-cover transition-transform duration-300"
      :class="isHovered ? 'scale-105' : ''"
      loading="lazy"
      @error="onLoadError"
    />

    <!-- Video placeholder -->
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

    <!-- Stars (top-left) -->
    <div
      class="absolute top-2 left-2 z-10 flex gap-px transition-opacity duration-150"
      :class="currentRating > 0 || isHovered ? 'opacity-100' : 'opacity-0'"
      @click.stop
    >
      <button
        v-for="n in 5"
        :key="n"
        @click="setRating(n)"
        @mouseenter="hoverRating = n"
        @mouseleave="hoverRating = 0"
        class="transition-transform hover:scale-125"
        :title="`${n} star${n > 1 ? 's' : ''}`"
      >
        <StarIconSolid
          v-if="n <= (hoverRating || currentRating)"
          class="w-3.5 h-3.5 text-yellow-400 drop-shadow"
        />
        <StarIcon
          v-else
          class="w-3.5 h-3.5 text-white/50 drop-shadow"
        />
      </button>
    </div>

    <!-- Checkbox (top-right) -->
    <div
      class="absolute top-2 right-2 z-10 transition-opacity duration-150"
      :class="selected || isHovered ? 'opacity-100' : 'opacity-0'"
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

    <!-- Video badge (bottom-left) -->
    <div
      v-if="file.type === 'video'"
      class="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-xs font-medium flex items-center gap-1"
    >
      <PlayIcon class="w-3 h-3" />
      VIDEO
    </div>

    <!-- Hover overlay -->
    <div
      class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-200 flex flex-col items-center justify-center gap-2 p-3"
      :class="isHovered || renaming ? 'opacity-100' : 'opacity-0 pointer-events-none'"
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
          @click.stop="$emit('preview', file)"
          class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-medium hover:bg-white/20 transition-colors"
        >
          <PlayIcon v-if="file.type === 'video'" class="w-3 h-3" />
          <MagnifyingGlassPlusIcon v-else class="w-3 h-3" />
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
  CheckIcon,
  PencilIcon,
  XMarkIcon,
  TrashIcon,
  FolderArrowDownIcon,
  StarIcon,
  MagnifyingGlassPlusIcon,
} from '@heroicons/vue/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/vue/24/solid';

const props = defineProps({
  file: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  showPostNow: { type: Boolean, default: true },
});

const emit = defineEmits(['select', 'toggle', 'postNow', 'preview', 'renamed', 'delete', 'sendTo', 'rated']);

const loadError = ref(false);
const isHovered = ref(false);
const renaming = ref(false);
const renameValue = ref('');
const renameInput = ref(null);
const hoverRating = ref(0);
const currentRating = ref(props.file.rating || 0);

function onLoadError() {
  loadError.value = true;
}

async function setRating(n) {
  // Click the current rating to clear it
  const newRating = n === currentRating.value ? 0 : n;
  currentRating.value = newRating;
  try {
    await axios.post('/media/rating', { subpath: props.file.subpath, rating: newRating });
    emit('rated', { file: props.file, rating: newRating });
  } catch (err) {
    console.error('Failed to save rating:', err.message);
    currentRating.value = props.file.rating || 0;
  }
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
