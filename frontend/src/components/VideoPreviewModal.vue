<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex flex-col bg-gray-950 animate-fade-in"
      tabindex="-1"
      @keydown.escape.stop="$emit('close')"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <!-- Tab switcher (videos only) -->
        <div v-if="file.type === 'video'" class="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          <button
            v-for="tab in ['preview', 'crop']"
            :key="tab"
            @click="activeTab = tab"
            class="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 capitalize"
            :class="activeTab === tab
              ? 'bg-white/10 text-white shadow'
              : 'text-gray-400 hover:text-white'"
          >
            <span v-if="tab === 'preview'">▶ Preview</span>
            <span v-else>✂ Crop</span>
          </button>
        </div>
        <!-- Image indicator -->
        <div v-else class="px-5 py-2 rounded-xl bg-white/5 text-sm font-medium text-gray-400">
          Photo
        </div>

        <div class="flex items-center gap-4">
          <div class="text-right">
            <p class="text-white text-sm font-medium">{{ file.name }}</p>
            <p class="text-gray-500 text-xs">{{ file.sizeFormatted }}</p>
          </div>
          <button
            @click="$emit('close')"
            class="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-all"
          >
            <XMarkIcon class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- ── PREVIEW TAB ── -->
      <div v-if="activeTab === 'preview'" class="flex-1 flex items-center justify-center p-6 min-h-0">
        <video
          v-if="file.type === 'video'"
          :src="file.url"
          controls
          autoplay
          class="rounded-2xl shadow-2xl max-w-full"
          style="max-height: calc(100vh - 120px)"
        />
        <img
          v-else
          :src="file.url"
          :alt="file.name"
          class="rounded-2xl shadow-2xl max-w-full max-h-full object-contain"
          style="max-height: calc(100vh - 120px)"
        />
      </div>

      <!-- ── CROP TAB (videos only) ── -->
      <div v-if="activeTab === 'crop' && file.type === 'video'" class="flex-1 flex min-h-0">

        <!-- Video + crop overlay -->
        <div
          class="flex-1 flex items-center justify-center bg-black/50 p-8 select-none overflow-hidden"
          @mousemove="onMouseMove"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
        >
          <div ref="videoWrapper" class="relative inline-block">
            <video
              ref="cropVideoEl"
              :src="file.url"
              class="block rounded-xl"
              style="max-width: 100%; max-height: calc(100vh - 220px)"
              muted
              @loadedmetadata="onVideoLoaded"
            />

            <!-- Crop box with dark overlay -->
            <div
              v-if="cropReady"
              ref="cropBoxEl"
              class="absolute cursor-move"
              :style="cropBoxStyle"
              @mousedown.prevent="startDrag"
            >
              <!-- Corner handles -->
              <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-sm shadow" />
              <div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-sm shadow" />
              <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-sm shadow" />
              <div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-sm shadow" />
              <!-- Rule of thirds grid -->
              <div class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                <div class="border-r border-b border-white" />
                <div class="border-r border-b border-white" />
                <div class="border-b border-white" />
                <div class="border-r border-b border-white" />
                <div class="border-r border-b border-white" />
                <div class="border-b border-white" />
                <div class="border-r border-white" />
                <div class="border-r border-white" />
                <div />
              </div>
            </div>

            <!-- Loading placeholder -->
            <div v-if="!cropReady" class="absolute inset-0 flex items-center justify-center">
              <div class="text-gray-400 text-sm">Loading video...</div>
            </div>
          </div>
        </div>

        <!-- Controls sidebar -->
        <div class="w-72 shrink-0 border-l border-white/10 flex flex-col">
          <div class="flex-1 p-5 space-y-6 overflow-y-auto">

            <!-- Aspect ratio presets -->
            <div>
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Aspect Ratio</h3>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="preset in ratioPresets"
                  :key="preset.label"
                  @click="applyRatio(preset)"
                  class="flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200"
                  :class="activeRatio === preset.label
                    ? 'border-pink-500/50 bg-pink-500/10 text-pink-400'
                    : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'"
                >
                  <div
                    class="border-2 rounded-sm"
                    :class="activeRatio === preset.label ? 'border-pink-400' : 'border-gray-500'"
                    :style="{ width: `${preset.iconW}px`, height: `${preset.iconH}px` }"
                  />
                  <span class="text-xs font-semibold">{{ preset.label }}</span>
                  <span class="text-xs opacity-60">{{ preset.desc }}</span>
                </button>
              </div>
            </div>

            <!-- Output info -->
            <div v-if="cropReady" class="bg-white/5 rounded-xl p-4 space-y-2.5">
              <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Output</h3>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Width</span>
                <span class="text-white font-mono">{{ Math.round(naturalCrop.w) }}px</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Height</span>
                <span class="text-white font-mono">{{ Math.round(naturalCrop.h) }}px</span>
              </div>
              <div class="flex justify-between text-xs">
                <span class="text-gray-500">Offset</span>
                <span class="text-white font-mono">{{ Math.round(naturalCrop.x) }}, {{ Math.round(naturalCrop.y) }}</span>
              </div>
            </div>

            <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
              Drag the crop box to reposition. The cropped video is saved as a new file — your original is untouched.
            </div>
          </div>

          <!-- Save button -->
          <div class="p-5 border-t border-white/10 space-y-3">
            <p v-if="cropError" class="text-red-400 text-xs">{{ cropError }}</p>
            <p v-if="cropSuccess" class="text-green-400 text-xs flex items-center gap-1.5">
              <CheckCircleIcon class="w-3.5 h-3.5 shrink-0" />
              Saved as <span class="font-mono truncate">{{ savedName }}</span>
            </p>
            <button
              @click="saveCrop"
              :disabled="!cropReady || saving"
              class="w-full py-3 rounded-xl font-semibold text-white bg-instagram-gradient
                     hover:opacity-90 active:scale-95 transition-all duration-200
                     disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              <ScissorsIcon v-else class="w-4 h-4" />
              {{ saving ? 'Cropping...' : 'Save Cropped Video' }}
            </button>
            <p class="text-gray-600 text-xs text-center">Saves a new file alongside the original</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { XMarkIcon, ScissorsIcon } from '@heroicons/vue/24/outline'
import { CheckCircleIcon } from '@heroicons/vue/24/solid'
import axios from 'axios'

const props = defineProps({
  file: { type: Object, required: true },
})

const emit = defineEmits(['close', 'cropped'])

const activeTab = ref('preview')

// ── Crop state ──
const cropVideoEl = ref(null)
const videoWrapper = ref(null)
const cropBoxEl = ref(null)
const cropReady = ref(false)

const cropX = ref(0)
const cropY = ref(0)
const cropW = ref(0)
const cropH = ref(0)

const videoNaturalW = ref(0)
const videoNaturalH = ref(0)
const videoDisplayW = ref(0)
const videoDisplayH = ref(0)

const activeRatio = ref('Original')
const saving = ref(false)
const cropError = ref('')
const cropSuccess = ref(false)
const savedName = ref('')

// Drag state
let isDragging = false
let dragStartMouseX = 0
let dragStartMouseY = 0
let dragStartCropX = 0
let dragStartCropY = 0

const ratioPresets = [
  { label: 'Original', desc: 'Native',  ratio: null, iconW: 32, iconH: 20 },
  { label: 'Square',   desc: '1:1',     ratio: 1,    iconW: 26, iconH: 26 },
  { label: 'Portrait', desc: '4:5',     ratio: 4/5,  iconW: 22, iconH: 28 },
  { label: 'Reels',    desc: '9:16',    ratio: 9/16, iconW: 16, iconH: 28 },
]

const cropBoxStyle = computed(() => ({
  left:   `${cropX.value}px`,
  top:    `${cropY.value}px`,
  width:  `${cropW.value}px`,
  height: `${cropH.value}px`,
  border: '2px solid rgba(255,255,255,0.9)',
  boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
}))

const naturalCrop = computed(() => {
  if (!videoDisplayW.value || !videoDisplayH.value) return { x: 0, y: 0, w: 0, h: 0 }
  const scaleX = videoNaturalW.value / videoDisplayW.value
  const scaleY = videoNaturalH.value / videoDisplayH.value
  return {
    x: cropX.value * scaleX,
    y: cropY.value * scaleY,
    w: cropW.value * scaleX,
    h: cropH.value * scaleY,
  }
})

async function onVideoLoaded() {
  await nextTick()
  const el = cropVideoEl.value
  if (!el) return

  videoNaturalW.value = el.videoWidth
  videoNaturalH.value = el.videoHeight
  videoDisplayW.value = el.clientWidth
  videoDisplayH.value = el.clientHeight

  // Default: full video
  cropX.value = 0
  cropY.value = 0
  cropW.value = videoDisplayW.value
  cropH.value = videoDisplayH.value
  cropReady.value = true
}

function applyRatio(preset) {
  activeRatio.value = preset.label
  cropError.value = ''
  cropSuccess.value = false

  if (!preset.ratio) {
    // Original — full video
    cropX.value = 0
    cropY.value = 0
    cropW.value = videoDisplayW.value
    cropH.value = videoDisplayH.value
    return
  }

  const displayAspect = videoDisplayW.value / videoDisplayH.value

  if (preset.ratio > displayAspect) {
    cropW.value = videoDisplayW.value
    cropH.value = videoDisplayW.value / preset.ratio
  } else {
    cropH.value = videoDisplayH.value
    cropW.value = videoDisplayH.value * preset.ratio
  }

  // Center
  cropX.value = (videoDisplayW.value - cropW.value) / 2
  cropY.value = (videoDisplayH.value - cropH.value) / 2
}

function startDrag(e) {
  isDragging = true
  dragStartMouseX = e.clientX
  dragStartMouseY = e.clientY
  dragStartCropX = cropX.value
  dragStartCropY = cropY.value
}

function onMouseMove(e) {
  if (!isDragging) return
  const dx = e.clientX - dragStartMouseX
  const dy = e.clientY - dragStartMouseY
  cropX.value = Math.max(0, Math.min(videoDisplayW.value - cropW.value, dragStartCropX + dx))
  cropY.value = Math.max(0, Math.min(videoDisplayH.value - cropH.value, dragStartCropY + dy))
}

function stopDrag() {
  isDragging = false
}

async function saveCrop() {
  if (!cropReady.value) return
  saving.value = true
  cropError.value = ''
  cropSuccess.value = false

  try {
    const response = await axios.post('/media/crop', {
      filePath: props.file.path,
      x: naturalCrop.value.x,
      y: naturalCrop.value.y,
      width: naturalCrop.value.w,
      height: naturalCrop.value.h,
    })
    savedName.value = response.data.fileName
    cropSuccess.value = true
    emit('cropped', response.data)
  } catch (err) {
    cropError.value = err.response?.data?.error || 'Crop failed — check that ffmpeg is available'
  } finally {
    saving.value = false
  }
}
</script>
