<template>
  <div class="p-6 h-full flex flex-col gap-6">
    <div>
      <h1 class="text-2xl font-bold text-white">Compose Post</h1>
      <p class="text-gray-400 text-sm mt-0.5">Create and publish your Instagram content</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">

      <!-- ── Left: media picker ── -->
      <div class="flex flex-col gap-3 min-h-0">
        <div class="flex items-center justify-between shrink-0">
          <h2 class="text-sm font-semibold text-white uppercase tracking-wider">Select Media</h2>
          <div class="flex gap-1">
            <button
              v-for="tab in ['all', 'image', 'video']"
              :key="tab"
              @click="mediaFilter = tab"
              class="px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 capitalize"
              :class="mediaFilter === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'"
            >{{ tab }}</button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto min-h-0">
          <div v-if="loadingMedia" class="grid grid-cols-3 gap-2">
            <div v-for="i in 9" :key="i" class="aspect-square bg-gray-900 rounded-lg animate-pulse" />
          </div>
          <div v-else-if="filteredMedia.length > 0" class="grid grid-cols-3 gap-2">
            <MediaCard
              v-for="file in filteredMedia"
              :key="file.subpath || file.name"
              :file="file"
              :selected="selectedFile?.path === file.path"
              :showPostNow="false"
              @select="selectFile"
            />
          </div>
          <div v-else class="flex flex-col items-center justify-center h-40 text-center">
            <PhotoIcon class="w-10 h-10 text-gray-700 mb-2" />
            <p class="text-gray-500 text-sm">No media files found</p>
            <RouterLink to="/library" class="text-pink-400 text-xs mt-1 hover:underline">Configure content folder</RouterLink>
          </div>
        </div>
      </div>

      <!-- ── Right: post details ── -->
      <div class="flex flex-col gap-4 overflow-y-auto min-h-0 pb-1">

        <!-- Preview -->
        <div class="card shrink-0">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Preview</h2>
          <div v-if="selectedFile" class="rounded-xl overflow-hidden bg-gray-800 relative" style="padding-top:100%">
            <img v-if="selectedFile.type === 'image'" :src="selectedFile.url" :alt="selectedFile.name"
              class="absolute inset-0 w-full h-full object-contain bg-gray-900" />
            <video v-else :src="selectedFile.url" class="absolute inset-0 w-full h-full object-contain bg-gray-900"
              controls preload="metadata" />
          </div>
          <div v-else class="rounded-xl bg-gray-800 flex flex-col items-center justify-center" style="height:200px">
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

          <div v-if="selectedFile?.type === 'video'" class="mt-3 flex gap-1">
            <button v-for="pt in ['FEED', 'REELS']" :key="pt" @click="postType = pt"
              class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              :class="postType === pt ? 'bg-instagram-gradient text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'">
              {{ pt === 'FEED' ? 'Feed Video' : 'Reels' }}
            </button>
          </div>

          <div v-if="preflightWarnings.length > 0 && preflightErrors.length === 0"
            class="mt-3 border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3">
            <p class="text-xs font-semibold text-yellow-400 mb-1">Video check</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="w in preflightWarnings" :key="w" class="text-xs text-yellow-300">{{ w }}</li>
            </ul>
          </div>
          <div v-if="preflightErrors.length > 0" class="mt-3 border border-red-500/30 bg-red-500/10 rounded-lg p-3">
            <p class="text-xs font-semibold text-red-400 mb-1">Cannot post</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="e in preflightErrors" :key="e" class="text-xs text-red-300">{{ e }}</li>
            </ul>
          </div>
        </div>

        <!-- Caption + AI -->
        <div class="card shrink-0">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Caption</h2>

          <textarea v-model="caption" placeholder="Write a caption… or generate one with AI below"
            class="input-field w-full resize-none min-h-[100px]" maxlength="2200" />
          <p class="text-xs text-right mt-1 mb-3" :class="caption.length > 2000 ? 'text-red-400' : 'text-gray-600'">
            {{ caption.length }}/2200
          </p>

          <!-- AI panel -->
          <div class="border border-white/10 rounded-xl overflow-hidden">
            <button @click="aiOpen = !aiOpen"
              class="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left">
              <span class="flex items-center gap-2 text-sm font-medium text-white">
                <SparklesIcon class="w-4 h-4 text-pink-400" />
                Generate with AI
              </span>
              <ChevronRightIcon class="w-4 h-4 text-gray-500 transition-transform duration-200" :class="aiOpen ? 'rotate-90' : ''" />
            </button>

            <div v-if="aiOpen" class="p-4 space-y-4 border-t border-white/10">
              <!-- Style -->
              <div>
                <p class="text-xs text-gray-500 mb-2">Style</p>
                <div class="flex flex-wrap gap-1.5">
                  <button v-for="s in aiStyles" :key="s.value" @click="aiStyle = s.value"
                    class="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    :class="aiStyle === s.value ? 'bg-instagram-gradient text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'">
                    {{ s.label }}
                  </button>
                </div>
              </div>

              <!-- Context -->
              <div>
                <p class="text-xs text-gray-500 mb-1.5">Context <span class="text-gray-600">(describe the post for better results)</span></p>
                <input v-model="aiContext" type="text" placeholder="e.g. sunset at the beach, golden hour vibes"
                  class="input-field w-full text-sm" />
              </div>

              <!-- Hashtags + Language -->
              <div class="flex gap-3">
                <div class="flex-1">
                  <p class="text-xs text-gray-500 mb-1.5">Hashtags</p>
                  <div class="flex gap-1">
                    <button v-for="n in [0, 5, 10, 15, 20]" :key="n" @click="aiHashtagCount = n"
                      class="flex-1 py-1 rounded-lg text-xs font-medium transition-all"
                      :class="aiHashtagCount === n ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'">
                      {{ n === 0 ? 'None' : n }}
                    </button>
                  </div>
                </div>
                <div class="w-28 shrink-0">
                  <p class="text-xs text-gray-500 mb-1.5">Language</p>
                  <input v-model="aiLanguage" type="text" placeholder="English" class="input-field w-full text-sm" />
                </div>
              </div>

              <button @click="generateCaptions" :disabled="generatingCaption || !selectedFile" class="btn-primary w-full">
                <svg v-if="generatingCaption" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <SparklesIcon v-else class="w-4 h-4" />
                {{ generatingCaption ? 'Generating…' : 'Generate 3 options' }}
              </button>

              <div v-if="captionOptions.length > 0" class="space-y-2">
                <p class="text-xs text-gray-500">Click an option to use it</p>
                <button v-for="(opt, i) in captionOptions" :key="i" @click="caption = opt"
                  class="w-full text-left p-3 rounded-xl border text-xs text-gray-300 leading-relaxed transition-all hover:text-white"
                  :class="caption === opt ? 'border-pink-500/50 bg-pink-500/10 text-white' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'">
                  {{ opt }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Post settings -->
        <div class="card shrink-0">
          <button @click="settingsOpen = !settingsOpen"
            class="w-full flex items-center justify-between text-left">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Post Settings</h2>
            <ChevronRightIcon class="w-4 h-4 text-gray-500 transition-transform duration-200" :class="settingsOpen ? 'rotate-90' : ''" />
          </button>

          <div v-if="settingsOpen" class="mt-4 space-y-4">
            <!-- Toggles -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-white">Hide like count</p>
                  <p class="text-xs text-gray-500">Viewers won't see how many likes this post has</p>
                </div>
                <button @click="postMeta.likeCountHidden = !postMeta.likeCountHidden"
                  class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer"
                  :class="postMeta.likeCountHidden ? 'bg-pink-500' : 'bg-gray-600'">
                  <span class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out"
                    :class="postMeta.likeCountHidden ? 'translate-x-4' : 'translate-x-0'" />
                </button>
              </div>

              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-white">Disable comments</p>
                  <p class="text-xs text-gray-500">No one can comment on this post</p>
                </div>
                <button @click="postMeta.commentsDisabled = !postMeta.commentsDisabled"
                  class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer"
                  :class="postMeta.commentsDisabled ? 'bg-pink-500' : 'bg-gray-600'">
                  <span class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out"
                    :class="postMeta.commentsDisabled ? 'translate-x-4' : 'translate-x-0'" />
                </button>
              </div>

              <div v-if="selectedFile?.type === 'video' && postType === 'REELS'" class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-white">Share to feed</p>
                  <p class="text-xs text-gray-500">Also show this Reel in your main feed grid</p>
                </div>
                <button @click="postMeta.shareToFeed = !postMeta.shareToFeed"
                  class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer"
                  :class="postMeta.shareToFeed ? 'bg-pink-500' : 'bg-gray-600'">
                  <span class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out"
                    :class="postMeta.shareToFeed ? 'translate-x-4' : 'translate-x-0'" />
                </button>
              </div>
            </div>

            <!-- Alt text (images) -->
            <div v-if="selectedFile?.type === 'image'">
              <label class="text-xs text-gray-500 block mb-1.5">Alt text <span class="text-gray-600">(accessibility)</span></label>
              <input v-model="postMeta.altText" type="text" placeholder="Describe the image for screen readers" class="input-field w-full text-sm" />
            </div>

            <!-- Tag people (images) -->
            <div v-if="selectedFile?.type === 'image'">
              <label class="text-xs text-gray-500 block mb-1.5">Tag people <span class="text-gray-600">(comma-separated Instagram usernames)</span></label>
              <input v-model="postMeta.userTags" type="text" placeholder="e.g. john_doe, jane_smith" class="input-field w-full text-sm" />
              <p class="text-gray-600 text-xs mt-1">Tags placed at centre of image — reposition on Instagram after posting.</p>
            </div>

            <!-- Location -->
            <div>
              <label class="text-xs text-gray-500 block mb-1.5">Location <span class="text-gray-600">(Facebook Place ID)</span></label>
              <input v-model="postMeta.locationId" type="text" placeholder="e.g. 110506962309835" class="input-field w-full text-sm" />
              <p class="text-gray-600 text-xs mt-1">Find it by opening the Facebook Page for the venue and copying the number from the URL.</p>
            </div>
          </div>
        </div>

        <!-- Schedule -->
        <div class="card shrink-0">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Schedule (Optional)</h2>
          <input v-model="scheduledAt" type="datetime-local" class="input-field w-full" :min="minDateTime" />
          <p class="text-xs text-gray-600 mt-1.5">Leave empty to add to end of queue</p>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 shrink-0">
          <button @click="addToQueue" :disabled="!selectedFile || addingToQueue" class="btn-secondary flex-1">
            <QueueListIcon v-if="!addingToQueue" class="w-4 h-4" />
            <svg v-else class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ addingToQueue ? 'Adding…' : 'Add to Queue' }}
          </button>
          <button @click="postNow" :disabled="!selectedFile || posting || preflightErrors.length > 0" class="btn-primary flex-1">
            <BoltIcon v-if="!posting" class="w-4 h-4" />
            <svg v-else class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ posting ? 'Publishing…' : 'Post Now' }}
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
  PhotoIcon, VideoCameraIcon, SparklesIcon, QueueListIcon,
  BoltIcon, ChevronRightIcon,
} from '@heroicons/vue/24/outline';
import MediaCard from '../components/MediaCard.vue';
import { useQueueStore } from '../stores/queue.js';
import { usePendingCompose } from '../composables/usePendingCompose.js';

const showToast = inject('showToast');
const queueStore = useQueueStore();
const { takePendingFile } = usePendingCompose();

// Media
const mediaFiles = ref([]);
const loadingMedia = ref(false);
const mediaFilter = ref('all');
const selectedFile = ref(null);

// Caption
const caption = ref('');
const captionOptions = ref([]);
const generatingCaption = ref(false);

// AI caption config
const aiOpen = ref(false);
const aiStyle = ref('casual');
const aiContext = ref('');
const aiHashtagCount = ref(10);
const aiLanguage = ref('English');
const aiStyles = [
  { label: 'Casual',       value: 'casual' },
  { label: 'Professional', value: 'professional' },
  { label: 'Funny',        value: 'funny' },
  { label: 'Motivational', value: 'motivational' },
];

// Post settings
const settingsOpen = ref(false);
const postMeta = ref({ likeCountHidden: false, commentsDisabled: false, altText: '', locationId: '', userTags: '', shareToFeed: true });

// Schedule / post
const scheduledAt = ref('');
const posting = ref(false);
const addingToQueue = ref(false);
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
  return mediaFiles.value.filter(f => f.type === mediaFilter.value);
});

async function loadMedia() {
  loadingMedia.value = true;
  try {
    const response = await axios.get('/media/files?recursive=true');
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
    const response = await axios.post('/posts/preflight', { mediaPath: file.subpath || file.name, postType: type });
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
  postMeta.value = { likeCountHidden: false, commentsDisabled: false, altText: '', locationId: '', userTags: '', shareToFeed: true };
  await runPreflight(file, 'REELS');
}

async function generateCaptions() {
  if (!selectedFile.value) return;
  generatingCaption.value = true;
  captionOptions.value = [];
  try {
    const response = await axios.post('/captions/generate', {
      mediaType: selectedFile.value.type === 'video' ? 'VIDEO' : 'IMAGE',
      style: aiStyle.value,
      context: aiContext.value || selectedFile.value.name,
      hashtagCount: aiHashtagCount.value,
      language: aiLanguage.value,
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
  if (selectedFile.value.type === 'video') {
    await runPreflight(selectedFile.value, postType.value);
    if (preflightErrors.value.length > 0) {
      showToast('Fix errors before posting: ' + preflightErrors.value[0], 'error');
      return;
    }
  }
  const userTagsArr = postMeta.value.userTags
    ? postMeta.value.userTags.split(',').map(u => ({ username: u.trim(), x: 0.5, y: 0.5 })).filter(u => u.username)
    : [];
  const metadata = {
    likeCountHidden: postMeta.value.likeCountHidden || undefined,
    commentsDisabled: postMeta.value.commentsDisabled || undefined,
    altText: postMeta.value.altText || undefined,
    locationId: postMeta.value.locationId || undefined,
    shareToFeed: postMeta.value.shareToFeed,
    userTags: userTagsArr.length > 0 ? userTagsArr : undefined,
  };
  posting.value = true;
  try {
    await axios.post('/posts/publish', { mediaPath: selectedFile.value.path, caption: caption.value, metadata });
    showToast('Post published successfully!', 'success');
    caption.value = '';
    selectedFile.value = null;
    captionOptions.value = [];
    preflightErrors.value = [];
    preflightWarnings.value = [];
    postMeta.value = { likeCountHidden: false, commentsDisabled: false, altText: '', locationId: '', userTags: '', shareToFeed: true };
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
    await queueStore.addToQueue(selectedFile.value.path, caption.value, scheduledAt.value || null);
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

watch(postType, newType => {
  if (selectedFile.value?.type === 'video') runPreflight(selectedFile.value, newType);
});

onMounted(async () => {
  await loadMedia();
  const preload = takePendingFile();
  if (preload) {
    const match = mediaFiles.value.find(f => f.path === preload.path);
    await selectFile(match || preload);
    if (!match) mediaFiles.value.unshift(preload);
  }
});
</script>
