<template>
  <div class="card hover:border-white/10 transition-all duration-200">
    <div class="flex items-start gap-4">
      <!-- Icon -->
      <div
        class="w-10 h-10 rounded-md flex items-center justify-center shrink-0 transition-all duration-200"
        :class="schedule.active ? 'bg-accent-500' : 'bg-white/5'"
      >
        <ClockIcon class="w-5 h-5 text-white" />
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <h3 class="text-white font-medium truncate">{{ schedule.name }}</h3>
          <span
            class="badge shrink-0"
            :class="schedule.active ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'"
          >
            {{ schedule.active ? 'Active' : 'Paused' }}
          </span>
        </div>

        <!-- Time and days -->
        <div class="flex items-center gap-3 mb-2">
          <span class="text-2xl font-bold text-gradient">{{ schedule.time }}</span>
          <div class="flex gap-1">
            <span
              v-for="day in allDays"
              :key="day.short"
              class="w-6 h-6 rounded text-xs font-medium flex items-center justify-center transition-all duration-200"
              :class="schedule.days.includes(day.short)
                ? 'bg-accent-500 text-white'
                : 'bg-white/5 text-gray-600'"
            >
              {{ day.label }}
            </span>
          </div>
        </div>

        <!-- Caption template -->
        <p class="text-gray-500 text-xs">
          <span class="text-gray-600">Caption: </span>
          {{ schedule.caption_template || '{auto}' }}
        </p>

        <!-- Next fire time -->
        <p v-if="schedule.active && schedule.nextFireTime" class="text-gray-500 text-xs mt-1">
          <span class="text-gray-600">Next post: </span>
          <span class="text-blue-400">{{ formatNextFire(schedule.nextFireTime) }}</span>
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2 shrink-0">
        <!-- Toggle switch -->
        <button
          @click="$emit('toggle', schedule)"
          class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none"
          :class="schedule.active ? 'bg-accent-500' : 'bg-gray-700'"
        >
          <span
            class="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
            :class="schedule.active ? 'translate-x-4' : 'translate-x-1'"
          />
        </button>

        <button
          @click="$emit('edit', schedule)"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-200"
          title="Edit"
        >
          <PencilIcon class="w-4 h-4" />
        </button>
        <button
          @click="$emit('delete', schedule)"
          class="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
          title="Delete"
        >
          <TrashIcon class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ClockIcon, PencilIcon, TrashIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  schedule: {
    type: Object,
    required: true,
  },
});

defineEmits(['toggle', 'edit', 'delete']);

const allDays = [
  { short: 'mon', label: 'M' },
  { short: 'tue', label: 'T' },
  { short: 'wed', label: 'W' },
  { short: 'thu', label: 'T' },
  { short: 'fri', label: 'F' },
  { short: 'sat', label: 'S' },
  { short: 'sun', label: 'S' },
];

function formatNextFire(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = date - now;

    if (diff < 60000) return 'in less than a minute';
    if (diff < 3600000) return `in ${Math.floor(diff / 60000)} minutes`;
    if (diff < 86400000) return `in ${Math.floor(diff / 3600000)} hours`;
    if (diff < 604800000) return `in ${Math.floor(diff / 86400000)} days`;

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
</script>
