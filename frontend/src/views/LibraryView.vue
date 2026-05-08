<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Media Library</h1>
        <p class="text-gray-400 text-sm mt-0.5">{{ files.length }} files{{ currentSubpath ? ` in ${currentSubpath}` : '' }}</p>
      </div>
      <div class="flex gap-2">
        <button @click="showNewFolderModal = true" class="btn-secondary">
          <FolderPlusIcon class="w-4 h-4" />
          New Folder
        </button>
        <button @click="loadFiles" class="btn-secondary">
          <ArrowPathIcon class="w-4 h-4" :class="loading ? 'animate-spin' : ''" />
          Refresh
        </button>
      </div>
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
        <button v-if="isElectron" @click="browseFolder" class="btn-secondary shrink-0">Browse</button>
        <button @click="updateFolder" :disabled="!folderPath || updatingFolder" class="btn-primary shrink-0">
          <CheckIcon class="w-4 h-4" />
          Set
        </button>
      </div>
      <p v-if="folderError" class="text-red-400 text-xs mt-2">{{ folderError }}</p>
      <p v-if="folderSuccess" class="text-green-400 text-xs mt-2 flex items-center gap-1">
        <CheckCircleIcon class="w-3.5 h-3.5" /> Folder updated
      </p>
      <p class="text-gray-600 text-xs mt-2">Supported: JPG, PNG, GIF, MP4, MOV</p>
    </div>

    <!-- Folder presets bar -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2 text-sm text-gray-400">
        <FolderArrowDownIcon class="w-4 h-4" />
        <span>{{ presets.length }} folder preset{{ presets.length !== 1 ? 's' : '' }} configured</span>
      </div>
      <button @click="showPresetsModal = true" class="btn-secondary text-xs py-1.5 px-3">
        <Cog6ToothIcon class="w-3.5 h-3.5" />
        Manage Presets
      </button>
    </div>

    <!-- Breadcrumbs -->
    <div v-if="breadcrumbs.length > 1" class="flex items-center gap-1 flex-wrap">
      <button
        v-for="(crumb, i) in breadcrumbs"
        :key="crumb.subpath"
        @click="navigateTo(crumb.subpath)"
        class="flex items-center gap-1 text-sm transition-colors"
        :class="i === breadcrumbs.length - 1 ? 'text-white font-medium cursor-default' : 'text-gray-400 hover:text-white'"
      >
        <FolderIcon v-if="i === 0" class="w-3.5 h-3.5" />
        {{ crumb.name }}
        <ChevronRightIcon v-if="i < breadcrumbs.length - 1" class="w-3.5 h-3.5 text-gray-600" />
      </button>
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
        <span v-if="tab.count !== undefined" class="ml-1.5 text-xs opacity-70">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Bulk action bar -->
    <div v-if="selectedSubpaths.length > 0" class="flex items-center justify-between bg-gray-900 border border-white/10 rounded-xl px-4 py-3 gap-3 flex-wrap">
      <div class="flex items-center gap-4">
        <span class="text-white text-sm font-medium">{{ selectedSubpaths.length }} selected</span>
        <button @click="selectedSubpaths = []" class="text-gray-400 text-xs hover:text-white transition-colors">Deselect all</button>
        <button @click="selectAll" class="text-gray-400 text-xs hover:text-white transition-colors">Select all</button>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="openBulkSendTo"
          :disabled="presets.length === 0"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FolderArrowDownIcon class="w-4 h-4" />
          Send to
        </button>
        <button
          @click="handleBulkDelete"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
        >
          <TrashIcon class="w-4 h-4" />
          Delete {{ selectedSubpaths.length }} file{{ selectedSubpaths.length > 1 ? 's' : '' }}
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      <div v-for="i in 12" :key="i" class="aspect-square bg-gray-900 rounded-xl animate-pulse border border-white/5" />
    </div>

    <!-- No folder configured -->
    <div v-else-if="!folderPath" class="text-center py-16">
      <FolderOpenIcon class="w-16 h-16 text-gray-700 mx-auto mb-4" />
      <h3 class="text-white font-semibold text-lg mb-2">No Content Folder Set</h3>
      <p class="text-gray-400 text-sm">Enter the path to your media folder above.</p>
    </div>

    <!-- Empty -->
    <div v-else-if="!loading && folders.length === 0 && filteredFiles.length === 0" class="text-center py-16">
      <PhotoIcon class="w-16 h-16 text-gray-700 mx-auto mb-4" />
      <h3 class="text-white font-semibold text-lg mb-2">{{ folderError || 'Nothing here' }}</h3>
      <p class="text-gray-400 text-sm">No media files or subfolders found.</p>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      <!-- Folder cards -->
      <button
        v-for="folder in folders"
        :key="folder.subpath"
        @click="navigateTo(folder.subpath)"
        class="group aspect-square bg-gray-900 border border-white/5 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-white/20 hover:bg-gray-800 transition-all duration-200"
      >
        <div class="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
          <FolderIcon class="w-6 h-6 text-orange-400" />
        </div>
        <span class="text-xs text-gray-300 text-center px-2 leading-tight line-clamp-2 group-hover:text-white transition-colors">{{ folder.name }}</span>
      </button>

      <!-- Media cards -->
      <MediaCard
        v-for="file in filteredFiles"
        :key="file.subpath"
        :file="file"
        :selected="selectedSubpaths.includes(file.subpath)"
        @toggle="toggleSelect"
        @postNow="handlePostNow"
        @addToQueue="handleAddToQueue"
        @preview="previewFile = $event"
        @renamed="handleRenamed"
        @delete="handleDelete"
        @sendTo="openSendTo"
      />
    </div>

    <!-- Video Preview Modal -->
    <VideoPreviewModal
      v-if="previewFile"
      :file="previewFile"
      @close="previewFile = null"
      @cropped="loadFiles"
    />

    <Teleport to="body">
      <!-- ── New Folder Modal ── -->
      <Transition name="modal">
        <div
          v-if="showNewFolderModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="showNewFolderModal = false; newFolderName = ''; newFolderError = ''"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div class="flex items-center justify-between mb-5">
              <h3 class="text-lg font-semibold text-white">New Folder</h3>
              <button
                @click="showNewFolderModal = false; newFolderName = ''; newFolderError = ''"
                class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
              >
                <XMarkIcon class="w-4 h-4" />
              </button>
            </div>
            <p v-if="currentSubpath" class="text-gray-500 text-xs mb-3">
              Creating inside: <span class="text-gray-400 font-mono">{{ currentSubpath }}</span>
            </p>
            <input
              v-model="newFolderName"
              type="text"
              placeholder="Folder name"
              class="input-field w-full mb-2"
              @keydown.enter="createFolder"
              @keydown.escape="showNewFolderModal = false"
              autofocus
            />
            <p v-if="newFolderError" class="text-red-400 text-xs mb-3">{{ newFolderError }}</p>
            <div class="flex gap-2 mt-4">
              <button @click="showNewFolderModal = false; newFolderName = ''; newFolderError = ''" class="btn-secondary flex-1">Cancel</button>
              <button @click="createFolder" :disabled="!newFolderName.trim() || creatingFolder" class="btn-primary flex-1">
                <FolderPlusIcon class="w-4 h-4" />
                {{ creatingFolder ? 'Creating...' : 'Create' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ── Manage Presets Modal ── -->
      <Transition name="modal">
        <div
          v-if="showPresetsModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="showPresetsModal = false"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]">
            <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <h3 class="text-lg font-semibold text-white">Folder Presets</h3>
              <button @click="showPresetsModal = false" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
                <XMarkIcon class="w-4 h-4" />
              </button>
            </div>

            <!-- Preset list -->
            <div class="flex-1 overflow-y-auto p-4 space-y-2">
              <div v-if="presets.length === 0" class="text-center py-8 text-gray-500 text-sm">
                No presets yet. Add one below.
              </div>
              <div
                v-for="preset in presets"
                :key="preset.id"
                class="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3"
              >
                <div class="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <FolderIcon class="w-4 h-4 text-orange-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-white text-sm font-medium">{{ preset.name }}</p>
                  <p class="text-gray-500 text-xs truncate">{{ preset.path }}</p>
                </div>
                <button
                  @click="removePreset(preset.id)"
                  class="shrink-0 w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <TrashIcon class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Add preset form -->
            <div class="border-t border-white/10 p-4 space-y-3 shrink-0">
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add New Preset</p>
              <input
                v-model="newPresetName"
                type="text"
                placeholder="Nickname (e.g. Edited, Archive, Client A)"
                class="input-field w-full"
              />
              <div class="flex gap-2">
                <input
                  v-model="newPresetPath"
                  type="text"
                  placeholder="Folder path"
                  class="input-field flex-1"
                  @keydown.enter="addPreset"
                />
                <button v-if="isElectron" @click="browsePresetFolder" class="btn-secondary shrink-0">Browse</button>
              </div>
              <button
                @click="addPreset"
                :disabled="!newPresetName.trim() || !newPresetPath.trim() || addingPreset"
                class="btn-primary w-full"
              >
                <PlusIcon class="w-4 h-4" />
                Add Preset
              </button>
              <p v-if="presetError" class="text-red-400 text-xs">{{ presetError }}</p>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ── Send To Modal ── -->
      <Transition name="modal">
        <div
          v-if="pendingSendFiles.length > 0"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="pendingSendFiles = []"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl">
            <div class="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div>
                <h3 class="text-lg font-semibold text-white">Send to...</h3>
                <p class="text-gray-500 text-xs mt-0.5">
                  {{ pendingSendFiles.length }} file{{ pendingSendFiles.length > 1 ? 's' : '' }} will be copied
                </p>
              </div>
              <button @click="pendingSendFiles = []" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all">
                <XMarkIcon class="w-4 h-4" />
              </button>
            </div>
            <div class="p-4 space-y-2">
              <div v-if="presets.length === 0" class="text-center py-6 text-gray-500 text-sm">
                No presets configured yet.
              </div>
              <button
                v-for="preset in presets"
                :key="preset.id"
                @click="executeSendTo(preset)"
                :disabled="sending"
                class="w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 text-left"
              >
                <div class="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  <FolderArrowDownIcon class="w-5 h-5 text-orange-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-white text-sm font-medium">{{ preset.name }}</p>
                  <p class="text-gray-500 text-xs truncate">{{ preset.path }}</p>
                </div>
                <svg v-if="sending" class="animate-spin w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <ChevronRightIcon v-else class="w-4 h-4 text-gray-600 shrink-0" />
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ── Post Now Modal ── -->
      <Transition name="modal">
        <div
          v-if="postNowFile"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="postNowFile = null"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-4">Post Now</h3>
            <div class="flex gap-4 mb-4">
              <img v-if="postNowFile.type === 'image'" :src="postNowFile.url" class="w-20 h-20 rounded-lg object-cover shrink-0" />
              <div v-else class="w-20 h-20 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                <VideoCameraIcon class="w-8 h-8 text-gray-600" />
              </div>
              <div class="flex-1">
                <p class="text-white text-sm font-medium">{{ postNowFile.name }}</p>
                <p class="text-gray-500 text-xs mt-1">{{ postNowFile.sizeFormatted }}</p>
              </div>
            </div>

            <div v-if="postNowFile.type === 'video'" class="flex gap-1 mb-4">
              <button
                v-for="pt in ['FEED', 'REELS']"
                :key="pt"
                @click="setPostNowType(pt)"
                class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                :class="postNowType === pt ? 'bg-instagram-gradient text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'"
              >
                {{ pt === 'FEED' ? 'Feed Video' : 'Reels' }}
              </button>
            </div>

            <div v-if="postNowPreflightWarnings.length > 0 && postNowPreflightErrors.length === 0" class="mb-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3">
              <p class="text-xs font-semibold text-yellow-400 mb-1">Video check</p>
              <ul class="list-disc list-inside space-y-0.5">
                <li v-for="w in postNowPreflightWarnings" :key="w" class="text-xs text-yellow-300">{{ w }}</li>
              </ul>
            </div>
            <div v-if="postNowPreflightErrors.length > 0" class="mb-4 border border-red-500/30 bg-red-500/10 rounded-lg p-3">
              <p class="text-xs font-semibold text-red-400 mb-1">Cannot post</p>
              <ul class="list-disc list-inside space-y-0.5">
                <li v-for="e in postNowPreflightErrors" :key="e" class="text-xs text-red-300">{{ e }}</li>
              </ul>
            </div>

            <textarea v-model="postNowCaption" placeholder="Write a caption... (optional)" class="input-field resize-none mb-2" rows="4" />
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
import { ref, computed, onMounted, inject } from 'vue'
import axios from 'axios'
import {
  ArrowPathIcon, FolderIcon, FolderOpenIcon, PhotoIcon,
  CheckIcon, BoltIcon, VideoCameraIcon, ChevronRightIcon,
  TrashIcon, FolderArrowDownIcon, Cog6ToothIcon, XMarkIcon, PlusIcon, FolderPlusIcon,
} from '@heroicons/vue/24/outline'
import { CheckCircleIcon } from '@heroicons/vue/24/solid'
import MediaCard from '../components/MediaCard.vue'
import VideoPreviewModal from '../components/VideoPreviewModal.vue'
import { useSettingsStore } from '../stores/settings.js'
import { useQueueStore } from '../stores/queue.js'

const showToast = inject('showToast')
const settingsStore = useSettingsStore()
const queueStore = useQueueStore()

const isElectron = !!window.electronAPI

const folders = ref([])
const files = ref([])
const loading = ref(false)
const currentSubpath = ref('')
const folderPath = ref('')
const folderError = ref('')
const folderSuccess = ref(false)
const updatingFolder = ref(false)
const activeFilter = ref('all')
const selectedSubpaths = ref([])

// Presets
const presets = ref([])
const showPresetsModal = ref(false)
const newPresetName = ref('')
const newPresetPath = ref('')
const addingPreset = ref(false)
const presetError = ref('')

// Send to
const pendingSendFiles = ref([])
const sending = ref(false)

// New folder
const showNewFolderModal = ref(false)
const newFolderName = ref('')
const creatingFolder = ref(false)
const newFolderError = ref('')

const previewFile = ref(null)
const postNowFile = ref(null)
const postNowCaption = ref('')
const posting = ref(false)
const postNowType = ref('REELS')
const postNowPreflightErrors = ref([])
const postNowPreflightWarnings = ref([])

const breadcrumbs = computed(() => {
  const crumbs = [{ name: 'Root', subpath: '' }]
  if (!currentSubpath.value) return crumbs
  const parts = currentSubpath.value.split('/')
  parts.forEach((part, i) => {
    crumbs.push({ name: part, subpath: parts.slice(0, i + 1).join('/') })
  })
  return crumbs
})

const filterTabs = computed(() => [
  { label: 'All', value: 'all', count: files.value.length },
  { label: 'Photos', value: 'image', count: files.value.filter(f => f.type === 'image').length },
  { label: 'Videos', value: 'video', count: files.value.filter(f => f.type === 'video').length },
])

const filteredFiles = computed(() => {
  if (activeFilter.value === 'all') return files.value
  return files.value.filter(f => f.type === activeFilter.value)
})

async function loadFiles() {
  loading.value = true
  folderError.value = ''
  try {
    const params = currentSubpath.value ? { subpath: currentSubpath.value } : {}
    const response = await axios.get('/media/files', { params })
    folders.value = response.data.folders || []
    files.value = response.data.files || []
    if (response.data.error) folderError.value = response.data.error
  } catch (err) {
    folderError.value = err.response?.data?.error || err.message
  } finally {
    loading.value = false
  }
}

async function createFolder() {
  const name = newFolderName.value.trim()
  if (!name) return
  creatingFolder.value = true
  newFolderError.value = ''
  try {
    await axios.post('/media/mkdir', { name, subpath: currentSubpath.value || undefined })
    showNewFolderModal.value = false
    newFolderName.value = ''
    await loadFiles()
    showToast(`Folder "${name}" created`, 'success')
  } catch (err) {
    newFolderError.value = err.response?.data?.error || 'Failed to create folder'
  } finally {
    creatingFolder.value = false
  }
}

async function loadPresets() {
  try {
    const response = await axios.get('/presets')
    presets.value = response.data
  } catch (err) {
    console.warn('Failed to load presets:', err.message)
  }
}

function navigateTo(subpath) {
  currentSubpath.value = subpath
  activeFilter.value = 'all'
  loadFiles()
}

async function browseFolder() {
  if (!window.electronAPI) return
  const selected = await window.electronAPI.selectFolder()
  if (selected) {
    folderPath.value = selected
    await updateFolder()
  }
}

async function browsePresetFolder() {
  if (!window.electronAPI) return
  const selected = await window.electronAPI.selectFolder()
  if (selected) newPresetPath.value = selected
}

async function updateFolder() {
  if (!folderPath.value) return
  updatingFolder.value = true
  folderError.value = ''
  folderSuccess.value = false
  try {
    await axios.post('/media/folder', { folderPath: folderPath.value })
    await settingsStore.saveSettings({ content_folder_path: folderPath.value })
    currentSubpath.value = ''
    folderSuccess.value = true
    setTimeout(() => { folderSuccess.value = false }, 3000)
    await loadFiles()
  } catch (err) {
    folderError.value = err.response?.data?.error || err.message
  } finally {
    updatingFolder.value = false
  }
}

async function addPreset() {
  if (!newPresetName.value.trim() || !newPresetPath.value.trim()) return
  addingPreset.value = true
  presetError.value = ''
  try {
    const response = await axios.post('/presets', {
      name: newPresetName.value.trim(),
      path: newPresetPath.value.trim(),
    })
    presets.value.push(response.data)
    newPresetName.value = ''
    newPresetPath.value = ''
  } catch (err) {
    presetError.value = err.response?.data?.error || 'Failed to add preset'
  } finally {
    addingPreset.value = false
  }
}

async function removePreset(id) {
  try {
    await axios.delete(`/presets/${id}`)
    presets.value = presets.value.filter(p => p.id !== id)
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to remove preset', 'error')
  }
}

function openSendTo(file) {
  pendingSendFiles.value = [file]
}

function openBulkSendTo() {
  pendingSendFiles.value = files.value.filter(f => selectedSubpaths.value.includes(f.subpath))
}

async function executeSendTo(preset) {
  sending.value = true
  const filePaths = pendingSendFiles.value.map(f => f.path)
  const count = filePaths.length
  try {
    const response = await axios.post('/presets/send', { filePaths, presetId: preset.id })
    pendingSendFiles.value = []
    selectedSubpaths.value = []
    showToast(`Copied ${response.data.copied} file${response.data.copied > 1 ? 's' : ''} to "${preset.name}"`, 'success')
  } catch (err) {
    showToast(err.response?.data?.error || 'Send failed', 'error')
  } finally {
    sending.value = false
  }
}

async function runPostNowPreflight(file, type) {
  postNowPreflightErrors.value = []
  postNowPreflightWarnings.value = []
  if (!file || file.type !== 'video') return
  try {
    const response = await axios.post('/posts/preflight', { mediaPath: file.subpath, postType: type })
    postNowPreflightErrors.value = response.data.errors || []
    postNowPreflightWarnings.value = response.data.warnings || []
  } catch (err) {
    console.warn('Preflight check failed:', err.message)
  }
}

async function handlePostNow(file) {
  postNowFile.value = file
  postNowCaption.value = ''
  postNowType.value = 'REELS'
  postNowPreflightErrors.value = []
  postNowPreflightWarnings.value = []
  await runPostNowPreflight(file, 'REELS')
}

async function setPostNowType(type) {
  postNowType.value = type
  await runPostNowPreflight(postNowFile.value, type)
}

function handleAddToQueue(file) {
  queueStore.addToQueue(file.path, '', null)
    .then(() => showToast(`Added "${file.name}" to queue`, 'success'))
    .catch(err => showToast(err.message, 'error'))
}

function toggleSelect(file) {
  const idx = selectedSubpaths.value.indexOf(file.subpath)
  if (idx === -1) selectedSubpaths.value.push(file.subpath)
  else selectedSubpaths.value.splice(idx, 1)
}

function selectAll() {
  selectedSubpaths.value = filteredFiles.value.map(f => f.subpath)
}

async function handleDelete(file) {
  if (!confirm(`Delete "${file.name}"?\n\nThis cannot be undone.`)) return
  try {
    await axios.delete('/media/files', { data: { filePaths: [file.path] } })
    files.value = files.value.filter(f => f.subpath !== file.subpath)
    selectedSubpaths.value = selectedSubpaths.value.filter(s => s !== file.subpath)
    showToast(`Deleted "${file.name}"`, 'success')
  } catch (err) {
    showToast(err.response?.data?.error || 'Delete failed', 'error')
  }
}

async function handleBulkDelete() {
  const count = selectedSubpaths.value.length
  if (!confirm(`Delete ${count} file${count > 1 ? 's' : ''}?\n\nThis cannot be undone.`)) return
  const toDelete = files.value.filter(f => selectedSubpaths.value.includes(f.subpath))
  try {
    await axios.delete('/media/files', { data: { filePaths: toDelete.map(f => f.path) } })
    const deleted = new Set(selectedSubpaths.value)
    files.value = files.value.filter(f => !deleted.has(f.subpath))
    selectedSubpaths.value = []
    showToast(`Deleted ${count} file${count > 1 ? 's' : ''}`, 'success')
  } catch (err) {
    showToast(err.response?.data?.error || 'Delete failed', 'error')
  }
}

function handleRenamed({ file, newName, newPath }) {
  const idx = files.value.findIndex(f => f.subpath === file.subpath)
  if (idx === -1) return
  const updated = { ...files.value[idx] }
  const dir = updated.subpath.includes('/') ? updated.subpath.substring(0, updated.subpath.lastIndexOf('/') + 1) : ''
  updated.name = newName
  updated.path = newPath
  updated.subpath = dir + newName
  updated.url = `/media/file/${(dir + newName).split('/').map(encodeURIComponent).join('/')}`
  files.value.splice(idx, 1, updated)
  showToast(`Renamed to "${newName}"`, 'success')
}

async function submitPostNow() {
  if (!postNowFile.value) return
  if (postNowFile.value.type === 'video') {
    await runPostNowPreflight(postNowFile.value, postNowType.value)
    if (postNowPreflightErrors.value.length > 0) {
      showToast('Fix errors before posting: ' + postNowPreflightErrors.value[0], 'error')
      return
    }
  }
  posting.value = true
  try {
    await axios.post('/posts/publish', { mediaPath: postNowFile.value.path, caption: postNowCaption.value })
    showToast('Post published successfully!', 'success')
    postNowFile.value = null
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to publish post', 'error')
  } finally {
    posting.value = false
  }
}

onMounted(async () => {
  await settingsStore.loadSettings()
  folderPath.value = settingsStore.contentFolder
  await Promise.all([loadFiles(), loadPresets()])
})
</script>

<style>
.modal-enter-active, .modal-leave-active { transition: all 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.95); }
</style>
