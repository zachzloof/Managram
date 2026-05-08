<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Media Library</h1>
        <p class="text-gray-400 text-sm mt-0.5">{{ files.length }} files in your content folder</p>
      </div>
      <button @click="loadFiles" class="btn-secondary">
        <ArrowPathIcon class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
    </div>

    <!-- Folder selector -->
    <div class="card">
      <div class="flex items-center gap-3 mb-3">
        <FolderIcon class="w-5 h-5 text-orange-400" />
        <h2 class="text-sm font-semibold text-white">Content Folder</h2>
      </div>
      <div class="flex gap-2">
        <input
          v-model="folderPath"
          type="text"
          placeholder="Enter folder path (e.g. C:\Users\You\Pictures\instagram)"
          class="input-field flex-1"
          @keydown.enter="updateFolder"
        />
        <button @click="updateFolder" :disabled="!folderPath || updatingFolder" class="btn-primary shrink-0">
          <CheckIcon class="w-4 h-4" />
          Set Folder
        </button>
      </div>
      <p v-if="folderError" class="text-red-400 text-xs mt-2">{{ folderError }}</p>
      <p v-if="folderSuccess" class="text-green-400 text-xs mt-2 flex items-center gap-1">
        <CheckCircleIcon class="w-3.5 h-3.5" />
        Folder updated successfully
      </p>
      <p class="text-gray-600 text-xs mt-2">
        Supported formats: JPG, PNG, GIF, MP4, MOV
      </p>
    </div>

    <!-- Filter tabs -->
    <div class="flex gap-2">
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        @click="activeFilter = tab.value"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
        :class="activeFilter === tab.value
          ? 'bg-instagram-gradient text-white shadow-glow-pink'
          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'"
      >
        {{ tab.label }}
        <span
          v-if="tab.count !== undefined"
          class="ml-1.5 text-xs opacity-70"
        >{{ tab.count }}</span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      <div
        v-for="i in 12"
        :key="i"
        class="aspect-square bg-gray-900 rounded-xl animate-pulse border border-white/5"
      />
    </div>

    <!-- No folder configured -->
    <div v-else-if="!folderPath && !loading" class="text-center py-16">
      <FolderOpenIcon class="w-16 h-16 text-gray-700 mx-auto mb-4" />
      <h3 class="text-white font-semibold text-lg mb-2">No Content Folder Set</h3>
      <p class="text-gray-400 text-sm max-w-sm mx-auto">
        Enter the path to your media folder above to start managing your Instagram content.
      </p>
    </div>

    <!-- No files in folder -->
    <div v-else-if="filteredFiles.length === 0 && !loading" class="text-center py-16">
      <PhotoIcon class="w-16 h-16 text-gray-700 mx-auto mb-4" />
      <h3 class="text-white font-semibold text-lg mb-2">
        {{ folderError || 'No media files found' }}
      </h3>
      <p class="text-gray-400 text-sm">
        Add images or videos to your content folder to see them here.
      </p>
    </div>

    <!-- Media grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      <MediaCard
        v-for="file in filteredFiles"
        :key="file.name"
        :file="file"
        @postNow="handlePostNow"
        @addToQueue="handleAddToQueue"
      />
    </div>

    <!-- Post Now Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="postNowFile"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="postNowFile = null"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-4">Post Now</h3>
            <div class="flex gap-4 mb-4">
              <img
                v-if="postNowFile.type === 'image'"
                :src="postNowFile.url"
                class="w-20 h-20 rounded-lg object-cover shrink-0"
              />
              <div v-else class="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                <VideoCameraIcon class="w-8 h-8 text-gray-600" />
              </div>
              <div class="flex-1">
                <p class="text-white text-sm font-medium">{{ postNowFile.name }}</p>
                <p class="text-gray-500 text-xs mt-1">{{ postNowFile.sizeFormatted }}</p>
              </div>
            </div>

            <!-- Post type selector for videos -->
            <div v-if="postNowFile.type === 'video'" class="flex gap-1 mb-4">
              <button
                v-for="pt in ['FEED', 'REELS']"
                :key="pt"
                @click="setPostNowType(pt)"
                class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                :class="postNowType === pt
                  ? 'bg-instagram-gradient text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'"
              >
                {{ pt === 'FEED' ? 'Feed Video' : 'Reels' }}
              </button>
            </div>

            <!-- Preflight banners -->
            <div
              v-if="postNowPreflightWarnings.length > 0 && postNowPreflightErrors.length === 0"
              class="mb-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3"
            >
              <p class="text-xs font-semibold text-yellow-400 mb-1">Video check</p>
              <ul class="list-disc list-inside space-y-0.5">
                <li v-for="w in postNowPreflightWarnings" :key="w" class="text-xs text-yellow-300">{{ w }}</li>
              </ul>
            </div>
            <div
              v-if="postNowPreflightErrors.length > 0"
              class="mb-4 border border-red-500/30 bg-red-500/10 rounded-lg p-3"
            >
              <p class="text-xs font-semibold text-red-400 mb-1">Cannot post</p>
              <ul class="list-disc list-inside space-y-0.5">
                <li v-for="e in postNowPreflightErrors" :key="e" class="text-xs text-red-300">{{ e }}</li>
              </ul>
            </div>

            <textarea
              v-model="postNowCaption"
              placeholder="Write a caption... (optional)"
              class="input-field resize-none mb-4"
              rows="4"
            />
            <p class="text-gray-500 text-xs text-right mb-4">{{ postNowCaption.length }}/2200</p>
            <div class="flex gap-2">
              <button @click="postNowFile = null" class="btn-secondary flex-1">Cancel</button>
              <button @click="submitPostNow" :disabled="posting || postNowPreflightErrors.length > 0" class="btn-primary flex-1">
                <svg v-if="posting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <BoltIcon v-else class="w-4 h-4" />
                {{ posting ? 'Posting...' : 'Post Now' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, inject } from 'vue';
import axios from 'axios';
import {
  ArrowPathIcon,
  FolderIcon,
  FolderOpenIcon,
  PhotoIcon,
  CheckIcon,
  BoltIcon,
  VideoCameraIcon,
} from '@heroicons/vue/24/outline';
import { CheckCircleIcon } from '@heroicons/vue/24/solid';
import MediaCard from '../components/MediaCard.vue';
import { useSettingsStore } from '../stores/settings.js';
import { useQueueStore } from '../stores/queue.js';

const showToast = inject('showToast');
const settingsStore = useSettingsStore();
const queueStore = useQueueStore();

const files = ref([]);
const loading = ref(false);
const folderPath = ref('');
const folderError = ref('');
const folderSuccess = ref(false);
const updatingFolder = ref(false);
const activeFilter = ref('all');

const postNowFile = ref(null);
const postNowCaption = ref('');
const posting = ref(false);
const postNowType = ref('REELS');
const postNowPreflightErrors = ref([]);
const postNowPreflightWarnings = ref([]);

const filterTabs = computed(() => [
  { label: 'All', value: 'all', count: files.value.length },
  { label: 'Photos', value: 'image', count: files.value.filter((f) => f.type === 'image').length },
  { label: 'Videos', value: 'video', count: files.value.filter((f) => f.type === 'video').length },
]);

const filteredFiles = computed(() => {
  if (activeFilter.value === 'all') return files.value;
  return files.value.filter((f) => f.type === activeFilter.value);
});

async function loadFiles() {
  loading.value = true;
  folderError.value = '';
  try {
    const response = await axios.get('/media/files');
    files.value = response.data.files || [];
    if (response.data.error) {
      folderError.value = response.data.error;
    }
  } catch (err) {
    folderError.value = err.response?.data?.error || err.message;
  } finally {
    loading.value = false;
  }
}

async function updateFolder() {
  if (!folderPath.value) return;
  updatingFolder.value = true;
  folderError.value = '';
  folderSuccess.value = false;
  try {
    await axios.post('/media/folder', { folderPath: folderPath.value });
    await settingsStore.saveSettings({ content_folder_path: folderPath.value });
    folderSuccess.value = true;
    setTimeout(() => { folderSuccess.value = false; }, 3000);
    await loadFiles();
  } catch (err) {
    folderError.value = err.response?.data?.error || err.message;
  } finally {
    updatingFolder.value = false;
  }
}

async function runPostNowPreflight(file, type) {
  postNowPreflightErrors.value = [];
  postNowPreflightWarnings.value = [];
  if (!file || file.type !== 'video') return;
  try {
    const response = await axios.post('/posts/preflight', {
      mediaPath: file.name,
      postType: type,
    });
    postNowPreflightErrors.value = response.data.errors || [];
    postNowPreflightWarnings.value = response.data.warnings || [];
  } catch (err) {
    console.warn('Preflight check failed:', err.message);
  }
}

async function handlePostNow(file) {
  postNowFile.value = file;
  postNowCaption.value = '';
  postNowType.value = 'REELS';
  postNowPreflightErrors.value = [];
  postNowPreflightWarnings.value = [];
  await runPostNowPreflight(file, 'REELS');
}

async function setPostNowType(type) {
  postNowType.value = type;
  await runPostNowPreflight(postNowFile.value, type);
}

function handleAddToQueue(file) {
  queueStore.addToQueue(file.path, '', null)
    .then(() => showToast(`Added "${file.name}" to queue`, 'success'))
    .catch((err) => showToast(err.message, 'error'));
}

async function submitPostNow() {
  if (!postNowFile.value) return;

  // Re-run preflight before posting
  if (postNowFile.value.type === 'video') {
    await runPostNowPreflight(postNowFile.value, postNowType.value);
    if (postNowPreflightErrors.value.length > 0) {
      showToast('Fix errors before posting: ' + postNowPreflightErrors.value[0], 'error');
      return;
    }
  }

  posting.value = true;
  try {
    await axios.post('/posts/publish', {
      mediaPath: postNowFile.value.path,
      caption: postNowCaption.value,
    });
    showToast('Post published successfully!', 'success');
    postNowFile.value = null;
    postNowPreflightErrors.value = [];
    postNowPreflightWarnings.value = [];
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to publish post', 'error');
  } finally {
    posting.value = false;
  }
}

onMounted(async () => {
  await settingsStore.loadSettings();
  folderPath.value = settingsStore.contentFolder;
  await loadFiles();
});
</script>

<style>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
