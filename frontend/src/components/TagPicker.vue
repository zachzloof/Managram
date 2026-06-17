<template>
  <div class="relative inline-block" @click.stop>
    <!-- Current tag chips -->
    <div class="flex flex-wrap items-center gap-1">
      <span
        v-for="tag in currentTags"
        :key="tag.id"
        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
        :style="{ backgroundColor: tag.color + '26', color: tag.color, border: `1px solid ${tag.color}40` }"
      >
        {{ tag.name }}
        <button @click="unassign(tag)" class="hover:opacity-70" title="Remove tag">
          <XMarkIcon class="w-2.5 h-2.5" />
        </button>
      </span>
      <button
        @click="open = !open"
        class="inline-flex items-center justify-center w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-gray-300 transition-colors"
        title="Add tag"
      >
        <PlusIcon class="w-3 h-3" />
      </button>
    </div>

    <!-- Popover -->
    <div
      v-if="open"
      class="absolute z-20 mt-1 w-48 bg-gray-850 border border-white/10 rounded-lg shadow-card p-2 space-y-1"
    >
      <button
        v-for="tag in availableTags"
        :key="tag.id"
        @click="assign(tag)"
        class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-gray-200 hover:bg-white/5 transition-colors text-left"
      >
        <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: tag.color }" />
        {{ tag.name }}
      </button>
      <p v-if="availableTags.length === 0 && !creating" class="text-xs text-gray-500 px-2 py-1">All tags assigned</p>

      <div class="border-t border-white/10 pt-1.5">
        <div v-if="creating" class="flex items-center gap-1 px-1">
          <input
            ref="createInput"
            v-model="newTagName"
            type="text"
            placeholder="Tag name"
            class="flex-1 bg-white/5 border border-white/20 rounded px-1.5 py-1 text-xs text-white outline-none focus:border-accent-500/60"
            @keydown.enter="confirmCreate"
            @keydown.escape="creating = false"
          />
          <button @click="confirmCreate" class="text-accent-400 hover:text-accent-300">
            <CheckIcon class="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          v-else
          @click="startCreate"
          class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <PlusIcon class="w-3 h-3" />
          New tag
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { PlusIcon, XMarkIcon, CheckIcon } from '@heroicons/vue/24/outline';
import { useTagsStore } from '../stores/tags.js';

const props = defineProps({
  subpath: { type: String, required: true },
  tags: { type: Array, default: () => [] },
});

const emit = defineEmits(['changed']);

const tagsStore = useTagsStore();
const open = ref(false);
const creating = ref(false);
const newTagName = ref('');
const createInput = ref(null);
const currentTags = ref([...props.tags]);

const PALETTE = ['#f5610c', '#22c55e', '#3b82f6', '#eab308', '#ec4899', '#06b6d4', '#a855f7', '#ef4444'];

const availableTags = computed(() =>
  tagsStore.tags.filter((t) => !currentTags.value.some((c) => c.id === t.id))
);

onMounted(() => {
  if (!tagsStore.loaded) tagsStore.loadTags();
  document.addEventListener('click', closeOnOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('click', closeOnOutsideClick);
});

function closeOnOutsideClick() {
  open.value = false;
  creating.value = false;
}

async function assign(tag) {
  try {
    await tagsStore.assignTag(props.subpath, tag.id);
    currentTags.value.push(tag);
    emit('changed', currentTags.value);
  } catch (err) {
    console.error('Failed to assign tag:', err.message);
  }
}

async function unassign(tag) {
  try {
    await tagsStore.unassignTag(props.subpath, tag.id);
    currentTags.value = currentTags.value.filter((t) => t.id !== tag.id);
    emit('changed', currentTags.value);
  } catch (err) {
    console.error('Failed to remove tag:', err.message);
  }
}

async function startCreate() {
  creating.value = true;
  newTagName.value = '';
  await nextTick();
  createInput.value?.focus();
}

async function confirmCreate() {
  const name = newTagName.value.trim();
  if (!name) return;
  try {
    const color = PALETTE[tagsStore.tags.length % PALETTE.length];
    const tag = await tagsStore.createTag(name, color);
    creating.value = false;
    await assign(tag);
  } catch (err) {
    console.error('Failed to create tag:', err.response?.data?.error || err.message);
  }
}
</script>
