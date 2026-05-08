<template>
  <!-- Single root — no overflow-hidden here; it breaks transitionend in Chromium/Electron -->
  <div class="h-full flex flex-col">

    <!-- Loading/redirect state: selectedFile is null until onMounted fires -->
    <div v-if="!selectedFile" class="flex-1 flex items-center justify-center">
      <div class="w-8 h-8 rounded-full border-2 border-white/10 border-t-pink-500 animate-spin" />
    </div>

    <!-- Full compose UI -->
    <template v-else>

    <!-- Header -->
    <div class="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
      <RouterLink
        to="/library"
        class="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors shrink-0"
      >
        <ArrowLeftIcon class="w-4 h-4" />
        Library
      </RouterLink>
      <span class="text-white/20 text-sm">/</span>
      <div class="flex items-center gap-2 min-w-0">
        <div class="w-5 h-5 rounded flex items-center justify-center bg-white/5 shrink-0">
          <VideoCameraIcon v-if="selectedFile.type === 'video'" class="w-3 h-3 text-gray-400" />
          <PhotoIcon v-else class="w-3 h-3 text-gray-400" />
        </div>
        <span class="text-white text-sm font-medium truncate">{{ selectedFile.name }}</span>
        <span class="text-gray-600 text-xs shrink-0">{{ selectedFile.sizeFormatted }}</span>
      </div>
    </div>

    <!-- Main: left = media, right = details -->
    <div class="flex-1 min-h-0 flex overflow-hidden">

      <!-- LEFT: preview / crop -->
      <div class="w-1/2 shrink-0 border-r border-white/5 flex flex-col bg-gray-950/40">

        <!-- Tab switcher (videos only) -->
        <div v-if="selectedFile.type === 'video'" class="flex items-center gap-1 p-3 shrink-0">
          <button
            v-for="tab in ['preview', 'crop', 'trim']"
            :key="tab"
            @click="mediaTab = tab"
            class="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
            :class="mediaTab === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'"
          >
            {{ tab === 'preview' ? '▶  Preview' : tab === 'crop' ? '⌗  Crop' : '✂  Trim' }}
          </button>
        </div>

        <!-- PREVIEW / IMAGE -->
        <div
          v-if="mediaTab === 'preview'"
          class="flex-1 flex items-center justify-center p-4 min-h-0"
        >
          <img
            v-if="selectedFile.type === 'image'"
            :src="selectedFile.url"
            :alt="selectedFile.name"
            class="rounded-xl max-w-full max-h-full object-contain shadow-2xl"
          />
          <video
            v-else
            :src="selectedFile.url"
            controls
            preload="metadata"
            class="rounded-xl max-w-full max-h-full object-contain shadow-2xl"
            @loadedmetadata="onVideoMetaLoaded"
          />
        </div>

        <!-- CROP (videos only) -->
        <div
          v-if="mediaTab === 'crop' && selectedFile.type === 'video'"
          class="flex-1 flex min-h-0"
          @mousemove="onMouseMove"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
        >
          <!-- Canvas -->
          <div class="flex-1 flex items-center justify-center bg-black/40 p-4 select-none min-h-0 overflow-hidden">
            <div ref="videoWrapper" class="relative inline-block">
              <video
                ref="cropVideoEl"
                :src="selectedFile.url"
                class="block rounded-xl"
                style="max-width: 100%; max-height: calc(100vh - 260px)"
                muted
                @loadedmetadata="onVideoLoaded"
              />
              <div
                v-if="cropReady"
                class="absolute cursor-move"
                :style="cropBoxStyle"
                @mousedown.prevent="startDrag"
              >
                <div class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white rounded-sm shadow" />
                <div class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white rounded-sm shadow" />
                <div class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white rounded-sm shadow" />
                <div class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white rounded-sm shadow" />
                <div class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                  <div class="border-r border-b border-white" /><div class="border-r border-b border-white" /><div class="border-b border-white" />
                  <div class="border-r border-b border-white" /><div class="border-r border-b border-white" /><div class="border-b border-white" />
                  <div class="border-r border-white" /><div class="border-r border-white" /><div />
                </div>
              </div>
              <div v-if="!cropReady" class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
                Loading video…
              </div>
            </div>
          </div>

          <!-- Crop controls -->
          <div class="w-56 shrink-0 border-l border-white/10 flex flex-col">
            <div class="flex-1 p-4 space-y-4 overflow-y-auto">
              <div>
                <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Aspect Ratio</h3>
                <div class="grid grid-cols-2 gap-1.5">
                  <button
                    v-for="preset in ratioPresets"
                    :key="preset.label"
                    @click="applyRatio(preset)"
                    class="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs transition-all"
                    :class="activeRatio === preset.label
                      ? 'border-pink-500/50 bg-pink-500/10 text-pink-400'
                      : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20 hover:text-white'"
                  >
                    <div
                      class="border-2 rounded-sm"
                      :class="activeRatio === preset.label ? 'border-pink-400' : 'border-gray-500'"
                      :style="{ width: `${preset.iconW}px`, height: `${preset.iconH}px` }"
                    />
                    <span class="font-semibold">{{ preset.label }}</span>
                    <span class="opacity-60">{{ preset.desc }}</span>
                  </button>
                </div>
              </div>

              <div v-if="cropReady" class="bg-white/5 rounded-xl p-3 space-y-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-gray-500">Size</span>
                  <span class="text-white font-mono">{{ Math.round(naturalCrop.w) }}×{{ Math.round(naturalCrop.h) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-500">Offset</span>
                  <span class="text-white font-mono">{{ Math.round(naturalCrop.x) }}, {{ Math.round(naturalCrop.y) }}</span>
                </div>
              </div>

              <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
                Saves as a new file — original untouched.
              </div>
            </div>

            <div class="p-4 border-t border-white/10 space-y-2">
              <p v-if="cropError" class="text-red-400 text-xs">{{ cropError }}</p>
              <p v-if="cropSuccess" class="text-green-400 text-xs flex items-center gap-1.5">
                <CheckCircleIcon class="w-3.5 h-3.5 shrink-0" />
                Saved as <span class="font-mono truncate">{{ savedName }}</span>
              </p>
              <button
                @click="saveCrop"
                :disabled="!cropReady || saving"
                class="w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-instagram-gradient hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <ScissorsIcon v-else class="w-4 h-4" />
                {{ saving ? 'Cropping…' : 'Save Cropped Video' }}
              </button>
            </div>
          </div>
        </div>

        <!-- TRIM (videos only) -->
        <div
          v-if="mediaTab === 'trim' && selectedFile.type === 'video'"
          class="flex-1 flex flex-col min-h-0"
          @mousemove="onTrimMouseMove"
          @mouseup="stopTrimDrag"
          @mouseleave="stopTrimDrag"
        >
          <!-- Video preview -->
          <div class="flex-1 flex items-center justify-center bg-black/40 p-3 min-h-0">
            <video
              ref="trimVideoEl"
              :src="selectedFile.url"
              class="rounded-xl max-w-full max-h-full object-contain"
              style="max-height: calc(50vh - 60px)"
              controls
              preload="metadata"
              @loadedmetadata="onVideoMetaLoaded"
            />
          </div>

          <!-- Timeline + controls -->
          <div class="shrink-0 p-4 space-y-3 border-t border-white/10">
            <!-- Too-long warning -->
            <div v-if="videoTooLong" class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
              <span class="shrink-0">⚠</span>
              <span>Video is {{ formatTime(videoDuration) }} — must be 90s or less. Adjust the handles and save.</span>
            </div>

            <!-- Timeline bar -->
            <div v-if="videoDuration > 0">
              <div
                ref="trimTimelineEl"
                class="relative h-8 bg-white/5 rounded-lg select-none overflow-visible"
              >
                <!-- Trimmed-off dark regions -->
                <div
                  class="absolute top-0 bottom-0 left-0 bg-black/50 rounded-l-lg"
                  :style="{ width: `${(trimStart / videoDuration) * 100}%` }"
                />
                <div
                  class="absolute top-0 bottom-0 right-0 bg-black/50 rounded-r-lg"
                  :style="{ width: `${((videoDuration - trimEnd) / videoDuration) * 100}%` }"
                />
                <!-- Selected region -->
                <div
                  class="absolute top-0 bottom-0 bg-pink-500/25 border-t border-b border-pink-500/40"
                  :style="{
                    left: `${(trimStart / videoDuration) * 100}%`,
                    width: `${((trimEnd - trimStart) / videoDuration) * 100}%`
                  }"
                />
                <!-- Start handle -->
                <div
                  class="absolute top-0 bottom-0 w-2 bg-pink-500 rounded-sm cursor-ew-resize z-10 flex items-center justify-center hover:bg-pink-400"
                  :style="{ left: `calc(${(trimStart / videoDuration) * 100}% - 4px)` }"
                  @mousedown.prevent="startTrimDrag('start')"
                >
                  <div class="w-0.5 h-3 bg-white/60 rounded pointer-events-none" />
                </div>
                <!-- End handle -->
                <div
                  class="absolute top-0 bottom-0 w-2 bg-pink-500 rounded-sm cursor-ew-resize z-10 flex items-center justify-center hover:bg-pink-400"
                  :style="{ left: `calc(${(trimEnd / videoDuration) * 100}% - 4px)` }"
                  @mousedown.prevent="startTrimDrag('end')"
                >
                  <div class="w-0.5 h-3 bg-white/60 rounded pointer-events-none" />
                </div>
              </div>
              <!-- Time labels -->
              <div class="flex justify-between text-xs mt-1.5 px-0.5">
                <span class="text-pink-400 font-mono">{{ formatTime(trimStart) }}</span>
                <span class="text-gray-500">{{ formatTime(trimDuration) }} selected</span>
                <span class="text-pink-400 font-mono">{{ formatTime(trimEnd) }}</span>
              </div>
            </div>

            <!-- Manual inputs -->
            <div class="flex gap-2">
              <div class="flex-1">
                <p class="text-xs text-gray-500 mb-1">Start (s)</p>
                <input
                  v-model.number="trimStart"
                  type="number" min="0" :max="trimEnd - 0.1" step="0.1"
                  class="input-field w-full text-sm font-mono"
                  @change="trimStart = Math.max(0, Math.min(trimEnd - 0.5, Number(trimStart)))"
                />
              </div>
              <div class="flex-1">
                <p class="text-xs text-gray-500 mb-1">End (s)</p>
                <input
                  v-model.number="trimEnd"
                  type="number" :min="trimStart + 0.1" :max="videoDuration" step="0.1"
                  class="input-field w-full text-sm font-mono"
                  @change="trimEnd = Math.min(videoDuration, Math.max(trimStart + 0.5, Number(trimEnd)))"
                />
              </div>
              <div class="flex-1">
                <p class="text-xs text-gray-500 mb-1">Duration</p>
                <div
                  class="input-field text-sm font-mono"
                  :class="trimDuration > 90 ? 'text-red-400' : 'text-gray-300'"
                >{{ formatTime(trimDuration) }}</div>
              </div>
            </div>

            <!-- Clip still too long -->
            <div v-if="trimDuration > 90" class="bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 text-xs text-red-300">
              Still {{ formatTime(trimDuration) }} — reduce to 90s or less.
            </div>

            <div class="space-y-1.5">
              <p v-if="trimError" class="text-red-400 text-xs">{{ trimError }}</p>
              <p v-if="trimSuccess" class="text-green-400 text-xs flex items-center gap-1.5">
                <CheckCircleIcon class="w-3.5 h-3.5 shrink-0" />
                Saved as {{ trimSavedName }}
              </p>
              <button
                @click="saveTrim"
                :disabled="trimSaving || videoDuration === 0 || trimDuration <= 0 || trimDuration > 90"
                class="w-full py-2.5 rounded-xl font-semibold text-sm text-white bg-instagram-gradient hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                <svg v-if="trimSaving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <ScissorsIcon v-else class="w-4 h-4" />
                {{ trimSaving ? 'Trimming…' : 'Save Trimmed Video' }}
              </button>
              <p class="text-gray-600 text-xs text-center">Saves as a new file — original untouched</p>
            </div>
          </div>
        </div>

        <!-- Video type picker + preflight (below preview) -->
        <div v-if="mediaTab === 'preview'" class="shrink-0 px-4 pb-4 space-y-3">
          <div v-if="selectedFile.type === 'video'" class="flex gap-1">
            <button
              v-for="pt in ['FEED', 'REELS']"
              :key="pt"
              @click="postType = pt"
              class="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              :class="postType === pt ? 'bg-instagram-gradient text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'"
            >
              {{ pt === 'FEED' ? 'Feed Video' : 'Reels' }}
            </button>
          </div>
          <div v-if="preflightWarnings.length > 0 && preflightErrors.length === 0"
            class="border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3">
            <p class="text-xs font-semibold text-yellow-400 mb-1">Video check</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="w in preflightWarnings" :key="w" class="text-xs text-yellow-300">{{ w }}</li>
            </ul>
          </div>
          <div v-if="preflightErrors.length > 0" class="border border-red-500/30 bg-red-500/10 rounded-lg p-3">
            <p class="text-xs font-semibold text-red-400 mb-1">Cannot post</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="e in preflightErrors" :key="e" class="text-xs text-red-300">{{ e }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- RIGHT: post details (scrollable) -->
      <div class="flex-1 overflow-y-auto p-5 space-y-4">

        <!-- Caption -->
        <div class="card">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Caption</h2>
          <textarea
            v-model="caption"
            placeholder="Write a caption… or generate one with AI below"
            class="input-field w-full resize-none min-h-[120px]"
            maxlength="2200"
          />
          <p class="text-xs text-right mt-1 mb-3" :class="caption.length > 2000 ? 'text-red-400' : 'text-gray-600'">
            {{ caption.length }}/2200
          </p>

          <!-- AI panel -->
          <div class="border border-white/10 rounded-xl overflow-hidden">
            <button
              @click="aiOpen = !aiOpen"
              class="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
            >
              <span class="flex items-center gap-2 text-sm font-medium text-white">
                <SparklesIcon class="w-4 h-4 text-pink-400" />
                Generate with AI
              </span>
              <ChevronRightIcon
                class="w-4 h-4 text-gray-500 transition-transform duration-200"
                :class="aiOpen ? 'rotate-90' : ''"
              />
            </button>
            <div v-if="aiOpen" class="p-4 space-y-4 border-t border-white/10">
              <div>
                <p class="text-xs text-gray-500 mb-2">Style</p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="s in aiStyles"
                    :key="s.value"
                    @click="aiStyle = s.value"
                    class="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    :class="aiStyle === s.value ? 'bg-instagram-gradient text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'"
                  >
                    {{ s.label }}
                  </button>
                </div>
              </div>
              <div>
                <p class="text-xs text-gray-500 mb-1.5">Context <span class="text-gray-600">(describe the post)</span></p>
                <input
                  v-model="aiContext"
                  type="text"
                  placeholder="e.g. sunset at the beach, golden hour vibes"
                  class="input-field w-full text-sm"
                />
              </div>
              <div class="flex gap-3">
                <div class="flex-1">
                  <p class="text-xs text-gray-500 mb-1.5">Hashtags</p>
                  <div class="flex gap-1">
                    <button
                      v-for="n in [0, 5, 10, 15, 20]"
                      :key="n"
                      @click="aiHashtagCount = n"
                      class="flex-1 py-1 rounded-lg text-xs font-medium transition-all"
                      :class="aiHashtagCount === n ? 'bg-white/15 text-white' : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'"
                    >
                      {{ n === 0 ? 'None' : n }}
                    </button>
                  </div>
                </div>
                <div class="w-28 shrink-0">
                  <p class="text-xs text-gray-500 mb-1.5">Language</p>
                  <input v-model="aiLanguage" type="text" placeholder="English" class="input-field w-full text-sm" />
                </div>
              </div>
              <button
                @click="generateCaptions"
                :disabled="generatingCaption"
                class="btn-primary w-full"
              >
                <svg v-if="generatingCaption" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <SparklesIcon v-else class="w-4 h-4" />
                {{ generatingCaption ? 'Generating…' : 'Generate 3 options' }}
              </button>
              <div v-if="captionOptions.length > 0" class="space-y-2">
                <p class="text-xs text-gray-500">Click an option to use it</p>
                <button
                  v-for="(opt, i) in captionOptions"
                  :key="i"
                  @click="caption = opt"
                  class="w-full text-left p-3 rounded-xl border text-xs text-gray-300 leading-relaxed transition-all hover:text-white"
                  :class="caption === opt ? 'border-pink-500/50 bg-pink-500/10 text-white' : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'"
                >
                  {{ opt }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Post settings -->
        <div class="card">
          <button @click="settingsOpen = !settingsOpen" class="w-full flex items-center justify-between text-left">
            <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider">Post Settings</h2>
            <ChevronRightIcon
              class="w-4 h-4 text-gray-500 transition-transform duration-200"
              :class="settingsOpen ? 'rotate-90' : ''"
            />
          </button>
          <div v-if="settingsOpen" class="mt-4 space-y-4">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-white">Hide like count</p>
                  <p class="text-xs text-gray-500">Viewers won't see how many likes this post has</p>
                </div>
                <button
                  @click="postMeta.likeCountHidden = !postMeta.likeCountHidden"
                  class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer"
                  :class="postMeta.likeCountHidden ? 'bg-pink-500' : 'bg-gray-600'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out"
                    :class="postMeta.likeCountHidden ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-white">Disable comments</p>
                  <p class="text-xs text-gray-500">No one can comment on this post</p>
                </div>
                <button
                  @click="postMeta.commentsDisabled = !postMeta.commentsDisabled"
                  class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer"
                  :class="postMeta.commentsDisabled ? 'bg-pink-500' : 'bg-gray-600'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out"
                    :class="postMeta.commentsDisabled ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>
              <div v-if="selectedFile.type === 'video' && postType === 'REELS'" class="flex items-center justify-between">
                <div>
                  <p class="text-sm text-white">Share to feed</p>
                  <p class="text-xs text-gray-500">Also show this Reel in your main feed grid</p>
                </div>
                <button
                  @click="postMeta.shareToFeed = !postMeta.shareToFeed"
                  class="relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer"
                  :class="postMeta.shareToFeed ? 'bg-pink-500' : 'bg-gray-600'"
                >
                  <span
                    class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out"
                    :class="postMeta.shareToFeed ? 'translate-x-4' : 'translate-x-0'"
                  />
                </button>
              </div>
            </div>
            <div v-if="selectedFile.type === 'image'">
              <label class="text-xs text-gray-500 block mb-1.5">Alt text <span class="text-gray-600">(accessibility)</span></label>
              <input v-model="postMeta.altText" type="text" placeholder="Describe the image for screen readers" class="input-field w-full text-sm" />
            </div>
            <div v-if="selectedFile.type === 'image'">
              <label class="text-xs text-gray-500 block mb-1.5">Tag people <span class="text-gray-600">(comma-separated Instagram usernames)</span></label>
              <input v-model="postMeta.userTags" type="text" placeholder="e.g. john_doe, jane_smith" class="input-field w-full text-sm" />
              <p class="text-gray-600 text-xs mt-1">Tags placed at centre — reposition on Instagram after posting.</p>
            </div>
            <div>
              <label class="text-xs text-gray-500 block mb-1.5">Location <span class="text-gray-600">(Facebook Place ID)</span></label>
              <input v-model="postMeta.locationId" type="text" placeholder="e.g. 110506962309835" class="input-field w-full text-sm" />
            </div>
          </div>
        </div>

        <!-- Queue (optional time) -->
        <div class="card">
          <h2 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Schedule (Optional)</h2>
          <input v-model="scheduledAt" type="datetime-local" class="input-field w-full" :min="minDateTime" :max="maxDateTime" />
          <p class="text-xs text-gray-600 mt-1.5">5 minutes – 70 days from now. Leave empty to post at next slot.</p>
        </div>

        <!-- Video too long: block posting -->
        <div v-if="videoTooLong" class="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <p class="text-amber-300 text-sm font-medium">Video is too long</p>
            <p class="text-amber-400/70 text-xs mt-0.5">{{ formatTime(videoDuration) }} — Instagram requires 90s or less.</p>
          </div>
          <button
            @click="mediaTab = 'trim'"
            class="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/30 transition-colors"
          >
            Trim →
          </button>
        </div>

        <!-- Actions -->
        <div class="flex gap-2 pb-2">
          <button @click="addToQueue" :disabled="addingToQueue || videoTooLong" class="btn-secondary flex-1">
            <QueueListIcon v-if="!addingToQueue" class="w-4 h-4" />
            <svg v-else class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            {{ addingToQueue ? 'Adding…' : 'Add to Queue' }}
          </button>
          <button @click="postNow" :disabled="posting || preflightErrors.length > 0 || videoTooLong" class="btn-primary flex-1">
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

    </template> <!-- end v-else (selectedFile loaded) -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, inject } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import axios from 'axios';
import {
  PhotoIcon, VideoCameraIcon, SparklesIcon, QueueListIcon,
  BoltIcon, ChevronRightIcon, ArrowLeftIcon, ScissorsIcon,
} from '@heroicons/vue/24/outline';
import { CheckCircleIcon } from '@heroicons/vue/24/solid';
import { useQueueStore } from '../stores/queue.js';
import { usePendingCompose } from '../composables/usePendingCompose.js';
import { toUKDatetimeLocal } from '../utils/time.js';

const showToast = inject('showToast');
const queueStore = useQueueStore();
const router = useRouter();
const { takePendingFile } = usePendingCompose();

// ── Selected file ──
const selectedFile = ref(null);
const mediaTab = ref('preview');

// ── Caption ──
const caption = ref('');
const captionOptions = ref([]);
const generatingCaption = ref(false);

// ── AI config ──
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

// ── Post settings ──
const settingsOpen = ref(false);
const postMeta = ref({ likeCountHidden: false, commentsDisabled: false, altText: '', locationId: '', userTags: '', shareToFeed: true });

// ── Schedule / post ──
const scheduledAt = ref('');
const posting = ref(false);
const addingToQueue = ref(false);
const postType = ref('REELS');
const preflightErrors = ref([]);
const preflightWarnings = ref([]);

const minDateTime = computed(() => toUKDatetimeLocal(new Date(Date.now() + 5 * 60 * 1000)));
const maxDateTime = computed(() => toUKDatetimeLocal(new Date(Date.now() + 70 * 24 * 60 * 60 * 1000)));

// ── Video duration / trim ──
const videoDuration = ref(0);
const trimStart = ref(0);
const trimEnd = ref(0);
const trimVideoEl = ref(null);
const trimTimelineEl = ref(null);
const trimSaving = ref(false);
const trimError = ref('');
const trimSuccess = ref(false);
const trimSavedName = ref('');

let trimDragging = null;
let trimTimelineRect = null;

const videoTooLong = computed(() => selectedFile.value?.type === 'video' && videoDuration.value > 90);
const trimDuration = computed(() => Math.max(0, trimEnd.value - trimStart.value));

function formatTime(secs) {
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function onVideoMetaLoaded(e) {
  const dur = e.target.duration;
  if (!dur || !isFinite(dur)) return;
  videoDuration.value = dur;
  trimStart.value = 0;
  trimEnd.value = Math.min(dur, 90);
}

function startTrimDrag(handle) {
  trimDragging = handle;
  trimTimelineRect = trimTimelineEl.value?.getBoundingClientRect() ?? null;
}

function onTrimMouseMove(e) {
  if (!trimDragging || !trimTimelineRect) return;
  const pct = Math.max(0, Math.min(1, (e.clientX - trimTimelineRect.left) / trimTimelineRect.width));
  const time = pct * videoDuration.value;
  if (trimDragging === 'start') {
    trimStart.value = Math.max(0, Math.min(trimEnd.value - 0.5, time));
  } else {
    trimEnd.value = Math.min(videoDuration.value, Math.max(trimStart.value + 0.5, time));
  }
}

function stopTrimDrag() { trimDragging = null; }

async function saveTrim() {
  trimSaving.value = true;
  trimError.value = '';
  trimSuccess.value = false;
  try {
    const response = await axios.post('/media/trim', {
      filePath: selectedFile.value.path,
      startTime: trimStart.value,
      endTime: trimEnd.value,
    });
    trimSavedName.value = response.data.fileName;
    trimSuccess.value = true;

    const origSubpath = selectedFile.value.subpath || selectedFile.value.name;
    const parts = origSubpath.split('/');
    parts[parts.length - 1] = response.data.fileName;
    const newSubpath = parts.join('/');
    const encoded = newSubpath.split('/').map(encodeURIComponent).join('/');

    setTimeout(() => {
      const newDur = trimEnd.value - trimStart.value;
      selectedFile.value = {
        ...selectedFile.value,
        path: response.data.filePath,
        name: response.data.fileName,
        subpath: newSubpath,
        url: `/media/file/${encoded}`,
      };
      videoDuration.value = newDur;
      trimStart.value = 0;
      trimEnd.value = newDur;
      mediaTab.value = 'preview';
      showToast(`Saved as ${response.data.fileName}`, 'success');
    }, 800);
  } catch (err) {
    trimError.value = err.response?.data?.error || 'Trim failed — check ffmpeg is available';
  } finally {
    trimSaving.value = false;
  }
}

// ── Crop state ──
const cropVideoEl = ref(null);
const videoWrapper = ref(null);
const cropReady = ref(false);
const cropX = ref(0);
const cropY = ref(0);
const cropW = ref(0);
const cropH = ref(0);
const videoNaturalW = ref(0);
const videoNaturalH = ref(0);
const videoDisplayW = ref(0);
const videoDisplayH = ref(0);
const activeRatio = ref('Original');
const saving = ref(false);
const cropError = ref('');
const cropSuccess = ref(false);
const savedName = ref('');

let isDragging = false;
let dragStartMouseX = 0;
let dragStartMouseY = 0;
let dragStartCropX = 0;
let dragStartCropY = 0;

const ratioPresets = [
  { label: 'Original', desc: 'Native',  ratio: null, iconW: 32, iconH: 20 },
  { label: 'Square',   desc: '1:1',     ratio: 1,    iconW: 26, iconH: 26 },
  { label: 'Portrait', desc: '4:5',     ratio: 4/5,  iconW: 22, iconH: 28 },
  { label: 'Reels',    desc: '9:16',    ratio: 9/16, iconW: 16, iconH: 28 },
];

const cropBoxStyle = computed(() => ({
  left:   `${cropX.value}px`,
  top:    `${cropY.value}px`,
  width:  `${cropW.value}px`,
  height: `${cropH.value}px`,
  border: '2px solid rgba(255,255,255,0.9)',
  boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
}));

const naturalCrop = computed(() => {
  if (!videoDisplayW.value || !videoDisplayH.value) return { x: 0, y: 0, w: 0, h: 0 };
  const scaleX = videoNaturalW.value / videoDisplayW.value;
  const scaleY = videoNaturalH.value / videoDisplayH.value;
  return {
    x: cropX.value * scaleX,
    y: cropY.value * scaleY,
    w: cropW.value * scaleX,
    h: cropH.value * scaleY,
  };
});

watch(mediaTab, () => {
  cropReady.value = false;
  cropError.value = '';
  cropSuccess.value = false;
  activeRatio.value = 'Original';
  trimError.value = '';
  trimSuccess.value = false;
});

async function onVideoLoaded() {
  const el = cropVideoEl.value;
  if (!el) return;
  videoNaturalW.value = el.videoWidth;
  videoNaturalH.value = el.videoHeight;
  videoDisplayW.value = el.clientWidth;
  videoDisplayH.value = el.clientHeight;
  cropX.value = 0;
  cropY.value = 0;
  cropW.value = videoDisplayW.value;
  cropH.value = videoDisplayH.value;
  cropReady.value = true;
}

function applyRatio(preset) {
  activeRatio.value = preset.label;
  cropError.value = '';
  cropSuccess.value = false;
  if (!preset.ratio) {
    cropX.value = 0; cropY.value = 0;
    cropW.value = videoDisplayW.value; cropH.value = videoDisplayH.value;
    return;
  }
  const displayAspect = videoDisplayW.value / videoDisplayH.value;
  if (preset.ratio > displayAspect) {
    cropW.value = videoDisplayW.value;
    cropH.value = videoDisplayW.value / preset.ratio;
  } else {
    cropH.value = videoDisplayH.value;
    cropW.value = videoDisplayH.value * preset.ratio;
  }
  cropX.value = (videoDisplayW.value - cropW.value) / 2;
  cropY.value = (videoDisplayH.value - cropH.value) / 2;
}

function startDrag(e) {
  isDragging = true;
  dragStartMouseX = e.clientX; dragStartMouseY = e.clientY;
  dragStartCropX = cropX.value; dragStartCropY = cropY.value;
}

function onMouseMove(e) {
  if (!isDragging) return;
  const dx = e.clientX - dragStartMouseX;
  const dy = e.clientY - dragStartMouseY;
  cropX.value = Math.max(0, Math.min(videoDisplayW.value - cropW.value, dragStartCropX + dx));
  cropY.value = Math.max(0, Math.min(videoDisplayH.value - cropH.value, dragStartCropY + dy));
}

function stopDrag() { isDragging = false; }

async function saveCrop() {
  if (!cropReady.value) return;
  saving.value = true;
  cropError.value = '';
  cropSuccess.value = false;
  try {
    const response = await axios.post('/media/crop', {
      filePath: selectedFile.value.path,
      x: naturalCrop.value.x,
      y: naturalCrop.value.y,
      width: naturalCrop.value.w,
      height: naturalCrop.value.h,
    });
    savedName.value = response.data.fileName;
    cropSuccess.value = true;

    // Derive new URL from the original file's subpath directory + new filename
    const origSubpath = selectedFile.value.subpath || selectedFile.value.name;
    const parts = origSubpath.split('/');
    parts[parts.length - 1] = response.data.fileName;
    const newSubpath = parts.join('/');
    const encoded = newSubpath.split('/').map(encodeURIComponent).join('/');

    // Update the selected file to the cropped version after a short delay
    setTimeout(() => {
      selectedFile.value = {
        ...selectedFile.value,
        path: response.data.filePath,
        name: response.data.fileName,
        subpath: newSubpath,
        url: `/media/file/${encoded}`,
        thumbnail: null,
      };
      mediaTab.value = 'preview';
      showToast(`Saved as ${response.data.fileName}`, 'success');
    }, 800);
  } catch (err) {
    cropError.value = err.response?.data?.error || 'Crop failed — check ffmpeg is available';
  } finally {
    saving.value = false;
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

async function generateCaptions() {
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
    router.push({ name: 'library' });
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
    router.push({ name: 'library' });
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
  const preload = takePendingFile();
  if (!preload) {
    router.replace({ name: 'library' });
    return;
  }
  selectedFile.value = preload;
  if (preload.type === 'video') runPreflight(preload, postType.value);
});
</script>
