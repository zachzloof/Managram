<template>
  <div class="p-6 h-full">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-white">Compose Post</h1>
      <p class="text-gray-400 text-sm mt-0.5">Create and publish your Instagram content</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100%-5rem)]">
      <!-- Left panel: Media selector -->
      <div class="flex flex-col gap-4 min-h-0">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-white uppercase tracking-wider">Select Media</h2>
          <div class="flex gap-1">
            <button
              v-for="tab in ['all', 'image', 'video']"
              :key="tab"
              @click="mediaFilter = tab"
              class="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 capitalize"
              :class="mediaFilter === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'"
            >
              {{ tab }}
            </button>
          </div>
        </div>

        <!-- Media grid -->
        <div class="flex-1 overflow-y-auto min-h-0">
          <div v-if="loadingMedia" class="grid grid-cols-3 gap-2">
            <div v-for="i in 9" :key="i" class="aspect-square bg-gray-900 rounded-lg animate-pulse" />
          </div>

          <div v-else-if="filteredMedia.length > 0" class="grid grid-cols-3 gap-2">
            <MediaCard
              v-for="file in filteredMedia"
              :key="file.name"
              :file="file"
              :selected="selectedFile?.name === file.name"
              :showPostNow="false"
              :showQueue="false"
              @select="selectFile"
            />
          </div>

          <div v-else class="flex flex-col items-center justify-center h-40 text-center">
            <PhotoIcon class="w-10 h-10 text-gray-700 mb-2" />
            <p class="text-gray-500 text-sm">No media files found</p>
            <RouterLink to="/library" class="text-pink-400 text-xs mt-1 hover:underline">
              Configure content folder
            </RouterLink>
          </div>
        </div>
      </div>

      <!-- Right panel: Post details -->
      <div class="flex flex-col gap-4">
        <!-- Media preview -->
        <div class="card flex-shrink-0">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</h2>
          <div
            v-if="selectedFile"
            class="rounded-xl overflow-hidden bg-gray-800 relative"
            style="padding-top: 100%; position: relative"
          >
            <img
              v-if="selectedFile.type === 'image'"
              :src="selectedFile.url"
              :alt="selectedFile.name"
              class="absolute inset-0 w-full h-full object-contain bg-gray-900"
            />
            <video
              v-else
              :src="selectedFile.url"
              class="absolute inset-0 w-full h-full object-contain bg-gray-900"
              controls
              preload="metadata"
            />
          </div>
          <div
            v-else
            class="rounded-xl bg-gray-800 flex flex-col items-center justify-center"
            style="height: 200px"
          >
            <PhotoIcon class="w-12 h-12 text-gray-700 mb-2" />
            <p class="text-gray-500 text-sm">Select a file from the left</p>
          </div>

          <div v-if="selectedFile" class="mt-3 flex items-center gap-2">
            <div class="w-6 h-6 rounded flex items-center justify-center bg-white/5">
              <VideoCameraIcon v-if="selectedFile.type === 'video'" class="w-3.5 h-3.5 text-gray-400" />
              <PhotoIcon v-else class="w-3.5 h-3.5 text-gray-400" />
            </div>
            <span class="text-gray-400 text-xs flex-1 truncate">{{ selectedFile.name }}</span>
            <span class="text-gray-600 text-xs">{{ selectedFile.sizeFormatted }}</span>
          </div>

          <!-- Post type selector for videos -->
          <div v-if="selectedFile?.type === 'video'" class="mt-3 flex gap-1">
            <button
              v-for="pt in ['FEED', 'REELS']"
              :key="pt"
              @click="postType = pt"
              class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              :class="postType === pt
                ? 'bg-instagram-gradient text-white'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'"
            >
              {{ pt === 'FEED' ? 'Feed Video' : 'Reels' }}
            </button>
          </div>

          <!-- Preflight banners -->
          <div
            v-if="preflightWarnings.length > 0 && preflightErrors.length === 0"
            class="mt-3 border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3"
          >
            <p class="text-xs font-semibold text-yellow-400 mb-1">Video check</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="w in preflightWarnings" :key="w" class="text-xs text-yellow-300">{{ w }}</li>
            </ul>
          </div>
          <div
            v-if="preflightErrors.length > 0"
            class="mt-3 border border-red-500/30 bg-red-500/10 rounded-lg p-3"
          >
            <p class="text-xs font-semibold text-red-400 mb-1">Cannot post</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="e in preflightErrors" :key="e" class="text-xs text-red-300">{{ e }}</li>
            </ul>
          </div>
        </div>

        <!-- Caption -->
        <div class="card flex-1 flex flex-col">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Caption</h2>
            <div class="flex items-center gap-2">
              <!-- Style selector -->
              <select
                v-model="captionStyle"
                class="input-field py-1 text-xs w-auto pr-6"
                style="background-image: none"
              >
                <option value="casual">Casual</option>
                <option value="professional">Professional</option>
                <option value="funny">Funny</option>
                <option value="motivational">Motivational</option>
              </select>
              <button
                @click="generateCaption"
                :disabled="generatingCaption || !selectedFile"
                class="btn-secondary py-1 px-3 text-xs"
              >
                <SparklesIcon class="w-3.5 h-3.5" :class="generatingCaption ? 'animate-spin' : ''" />
                {{ generatingCaption ? 'Generating...' : 'AI Caption' }}
              </button>
            </div>
          </div>

          <!-- AI caption options -->
          <Transition name="slide">
            <div v-if="captionOptions.length > 0" class="mb-3 space-y-2">
              <p class="text-xs text-gray-500 mb-2">Choose a generated caption:</p>
              <button
                v-for="(option, i) in captionOptions"
                :key="i"
                @click="caption = option; captionOptions = []"
                class="w-full text-left p-3 rounded-lg bg-white/5 border border-white/10 hover:border-pink-500/30 hover:bg-pink-500/5 text-sm text-gray-300 hover:text-white transition-all duration-200 line-clamp-3"
              >
                {{ option }}
              </button>
              <button @click="captionOptions = []" class="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                Dismiss
              </button>
            </div>
          </Transition>

          <div class="flex-1 flex flex-col">
            <textarea
              v-model="caption"
              placeholder="Write a caption... or use AI to generate one"
              class="input-field flex-1 resize-none min-h-[120px]"
              maxlength="2200"
            />
            <div class="flex items-center justify-between mt-2">
              <p class="text-xs text-gray-600">Max 2,200 characters</p>
              <p class="text-xs" :class="caption.length > 2000 ? 'text-red-400' : 'text-gray-600'">
                {{ caption.length }}/2200
              </p>
            </div>
          </div>
        </div>

        <!-- Scheduled time (for Queue) -->
        <div class="card">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Schedule (Optional)</h2>
          <input
            v-model="scheduledAt"
            type="datetime-local"
            class="input-field"
            :min="minDateTime"
          />
          <p class="text-xs text-gray-600 mt-1.5">Leave empty to add to end of queue</p>
        </div>

        <!-- Action buttons -->
        <div class="flex gap-2">
          <button
            @click="addToQueue"
            :disabled="!selectedFile || addingToQueue"
            class="btn-secondary flex-1"
          >
            <QueueListIcon v-if="!addingToQueue" class="w-4 h-4" />
            <svg v-else class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ addingToQueue ? 'Adding...' : 'Add to Queue' }}
          </button>
          <button
            @click="postNow"
            :disabled="!selectedFile || posting || preflightErrors.length > 0"
            class="btn-primary flex-1"
          >
            <BoltIcon v-if="!posting" class="w-4 h-4" />
            <svg v-else class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ posting ? 'Publishing...' : 'Post Now' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue';
import { RouterLink } from 'vue-router';
import axios from 'axios';
import {
  PhotoIcon,
  VideoCameraIcon,
  SparklesIcon,
  QueueListIcon,
  BoltIcon,
} from '@heroicons/vue/24/outline';
import MediaCard from '../components/MediaCard.vue';
import { useQueueStore } from '../stores/queue.js';

const showToast = inject('showToast');
const queueStore = useQueueStore();

const mediaFiles = ref([]);
const loadingMedia = ref(false);
const mediaFilter = ref('all');
const selectedFile = ref(null);
const caption = ref('');
const captionStyle = ref('casual');
const captionOptions = ref([]);
const generatingCaption = ref(false);
const scheduledAt = ref('');
const posting = ref(false);
const addingToQueue = ref(false);

// Video post type & preflight
const postType = ref('REELS');
const preflightErrors = ref([]);
const preflightWarnings = ref([]);

const minDateTime = computed(() => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  return now.toISOString().slice(0, 16);
});

const filteredMedia = computed(() => {
  if (mediaFilter.value === 'all') return mediaFiles.value;
  return mediaFiles.value.filter((f) => f.type === mediaFilter.value);
});

async function loadMedia() {
  loadingMedia.value = true;
  try {
    const response = await axios.get('/media/files');
    mediaFiles.value = response.data.files || [];
  } catch (err) {
    console.error('Failed to load media:', err);
  } finally {
    loadingMedia.value = false;
  }
}

async function runPreflight(file, type) {
  preflightErrors.value = [];
  preflightWarnings.value = [];
  if (!file || file.type !== 'video') return;
  try {
    const response = await axios.post('/posts/preflight', {
      mediaPath: file.name,
      postType: type,
    });
    preflightErrors.value = response.data.errors || [];
    preflightWarnings.value = response.data.warnings || [];
  } catch (err) {
    console.warn('Preflight check failed:', err.message);
  }
}

async function selectFile(file) {
  selectedFile.value = file;
  captionOptions.value = [];
  postType.value = 'REELS';
  await runPreflight(file, postType.value);
}

async function generateCaption() {
  if (!selectedFile.value) return;
  generatingCaption.value = true;
  captionOptions.value = [];
  try {
    const response = await axios.post('/captions/generate', {
      mediaType: selectedFile.value.type === 'video' ? 'VIDEO' : 'IMAGE',
      style: captionStyle.value,
      context: selectedFile.value.name,
    });
    captionOptions.value = response.data.captions || [];
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to generate captions', 'error');
  } finally {
    generatingCaption.value = false;
  }
}

async function postNow() {
  if (!selectedFile.value) return;

  // Re-run preflight before posting
  if (selectedFile.value.type === 'video') {
    await runPreflight(selectedFile.value, postType.value);
    if (preflightErrors.value.length > 0) {
      showToast('Fix errors before posting: ' + preflightErrors.value[0], 'error');
      return;
    }
  }

  posting.value = true;
  try {
    await axios.post('/posts/publish', {
      mediaPath: selectedFile.value.path,
      caption: caption.value,
    });
    showToast('Post published successfully!', 'success');
    caption.value = '';
    selectedFile.value = null;
    captionOptions.value = [];
    preflightErrors.value = [];
    preflightWarnings.value = [];
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to publish post', 'error');
  } finally {
    posting.value = false;
  }
}

async function addToQueue() {
  if (!selectedFile.value) return;
  addingToQueue.value = true;
  try {
    await queueStore.addToQueue(
      selectedFile.value.path,
      caption.value,
      scheduledAt.value || null
    );
    showToast('Added to queue!', 'success');
    caption.value = '';
    scheduledAt.value = '';
    selectedFile.value = null;
    captionOptions.value = [];
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to add to queue', 'error');
  } finally {
    addingToQueue.value = false;
  }
}

watch(postType, (newType) => {
  if (selectedFile.value?.type === 'video') {
    runPreflight(selectedFile.value, newType);
  }
});

onMounted(() => {
  loadMedia();
});
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
