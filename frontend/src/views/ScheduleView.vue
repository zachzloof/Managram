<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Schedules</h1>
        <p class="text-gray-400 text-sm mt-0.5">Auto-post at specific times</p>
      </div>
      <button @click="openAddModal" class="btn-primary">
        <PlusIcon class="w-4 h-4" />
        Add Schedule
      </button>
    </div>

    <!-- How it works info -->
    <div class="card bg-blue-500/5 border-blue-500/20">
      <div class="flex items-start gap-3">
        <InformationCircleIcon class="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p class="text-sm text-blue-300 font-medium">How Schedules Work</p>
          <p class="text-xs text-gray-400 mt-1">
            When a schedule fires, it posts the next pending queue item. If the queue is empty,
            it picks a random file from your content folder and generates an AI caption automatically.
          </p>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-28 bg-gray-900 rounded-xl animate-pulse border border-white/5" />
    </div>

    <!-- Empty state -->
    <div v-else-if="schedules.length === 0" class="text-center py-16">
      <div class="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
        <CalendarDaysIcon class="w-10 h-10 text-gray-700" />
      </div>
      <h3 class="text-white font-semibold text-lg mb-2">No Schedules Yet</h3>
      <p class="text-gray-400 text-sm max-w-sm mx-auto mb-6">
        Create posting schedules to automatically publish content at your preferred times.
      </p>
      <button @click="openAddModal" class="btn-primary">
        <PlusIcon class="w-4 h-4" />
        Create First Schedule
      </button>
    </div>

    <!-- Schedule list -->
    <div v-else class="space-y-3">
      <ScheduleCard
        v-for="schedule in schedules"
        :key="schedule.id"
        :schedule="schedule"
        @toggle="toggleSchedule"
        @edit="editSchedule"
        @delete="deleteSchedule"
      />
    </div>

    <!-- Add/Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="closeModal"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-5">
              {{ editingId ? 'Edit Schedule' : 'Add Schedule' }}
            </h3>

            <div class="space-y-4">
              <!-- Name -->
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Schedule Name</label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="e.g. Morning Post, Evening Update"
                  class="input-field"
                />
              </div>

              <!-- Time -->
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Time</label>
                <input
                  v-model="form.time"
                  type="time"
                  class="input-field"
                />
              </div>

              <!-- Days -->
              <div>
                <label class="block text-sm text-gray-400 mb-2">Days</label>
                <div class="flex gap-2">
                  <button
                    v-for="day in allDays"
                    :key="day.short"
                    @click="toggleDay(day.short)"
                    class="flex-1 h-9 rounded-lg text-sm font-medium transition-all duration-200"
                    :class="form.days.includes(day.short)
                      ? 'bg-accent-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'"
                  >
                    {{ day.label }}
                  </button>
                </div>
              </div>

              <!-- Quick day selectors -->
              <div class="flex gap-2">
                <button @click="setDays('weekdays')" class="text-xs text-gray-400 hover:text-accent-400 transition-colors">
                  Weekdays
                </button>
                <span class="text-gray-700">•</span>
                <button @click="setDays('weekends')" class="text-xs text-gray-400 hover:text-accent-400 transition-colors">
                  Weekends
                </button>
                <span class="text-gray-700">•</span>
                <button @click="setDays('all')" class="text-xs text-gray-400 hover:text-accent-400 transition-colors">
                  Every Day
                </button>
              </div>

              <!-- Caption template -->
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Caption Template</label>
                <input
                  v-model="form.captionTemplate"
                  type="text"
                  placeholder="{auto} — AI generated, or write a custom caption"
                  class="input-field"
                />
                <p class="text-xs text-gray-600 mt-1">
                  Use <code class="text-accent-400">{auto}</code> for AI-generated captions, or write a fixed caption
                </p>
              </div>
            </div>

            <p v-if="formError" class="text-red-400 text-sm mt-3">{{ formError }}</p>

            <div class="flex gap-2 mt-6">
              <button @click="closeModal" class="btn-secondary flex-1">Cancel</button>
              <button @click="saveSchedule" :disabled="saving" class="btn-primary flex-1">
                <svg v-if="saving" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <CheckIcon v-else class="w-4 h-4" />
                {{ saving ? 'Saving...' : (editingId ? 'Update' : 'Create') }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Delete Confirmation -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="deletingId"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="deletingId = null"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-2">Delete Schedule</h3>
            <p class="text-gray-400 text-sm mb-6">
              Are you sure you want to delete this schedule? This cannot be undone.
            </p>
            <div class="flex gap-2">
              <button @click="deletingId = null" class="btn-secondary flex-1">Cancel</button>
              <button @click="confirmDelete" :disabled="deleting" class="btn-danger flex-1">
                <svg v-if="deleting" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <TrashIcon v-else class="w-4 h-4" />
                {{ deleting ? 'Deleting...' : 'Delete' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue';
import axios from 'axios';
import {
  PlusIcon,
  CheckIcon,
  TrashIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
} from '@heroicons/vue/24/outline';
import ScheduleCard from '../components/ScheduleCard.vue';

const showToast = inject('showToast');

const schedules = ref([]);
const loading = ref(false);
const showModal = ref(false);
const editingId = ref(null);
const saving = ref(false);
const formError = ref('');
const deletingId = ref(null);
const deleting = ref(false);

const allDays = [
  { short: 'mon', label: 'Mo' },
  { short: 'tue', label: 'Tu' },
  { short: 'wed', label: 'We' },
  { short: 'thu', label: 'Th' },
  { short: 'fri', label: 'Fr' },
  { short: 'sat', label: 'Sa' },
  { short: 'sun', label: 'Su' },
];

const defaultForm = () => ({
  name: '',
  time: '09:00',
  days: ['mon', 'wed', 'fri'],
  captionTemplate: '{auto}',
});

const form = ref(defaultForm());

function openAddModal() {
  editingId.value = null;
  form.value = defaultForm();
  formError.value = '';
  showModal.value = true;
}

function editSchedule(schedule) {
  editingId.value = schedule.id;
  form.value = {
    name: schedule.name,
    time: schedule.time,
    days: [...(schedule.days || [])],
    captionTemplate: schedule.caption_template || '{auto}',
  };
  formError.value = '';
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editingId.value = null;
  formError.value = '';
}

function toggleDay(day) {
  const idx = form.value.days.indexOf(day);
  if (idx === -1) {
    form.value.days.push(day);
  } else {
    form.value.days.splice(idx, 1);
  }
}

function setDays(preset) {
  if (preset === 'weekdays') {
    form.value.days = ['mon', 'tue', 'wed', 'thu', 'fri'];
  } else if (preset === 'weekends') {
    form.value.days = ['sat', 'sun'];
  } else {
    form.value.days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  }
}

async function loadSchedules() {
  loading.value = true;
  try {
    const response = await axios.get('/schedule');
    schedules.value = response.data.schedules || [];
  } catch (err) {
    showToast('Failed to load schedules', 'error');
  } finally {
    loading.value = false;
  }
}

async function saveSchedule() {
  formError.value = '';

  if (!form.value.name.trim()) {
    formError.value = 'Schedule name is required';
    return;
  }
  if (!form.value.time) {
    formError.value = 'Time is required';
    return;
  }
  if (form.value.days.length === 0) {
    formError.value = 'Select at least one day';
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.value.name.trim(),
      time: form.value.time,
      days: form.value.days,
      captionTemplate: form.value.captionTemplate || '{auto}',
    };

    if (editingId.value) {
      const response = await axios.put(`/schedule/${editingId.value}`, payload);
      const idx = schedules.value.findIndex((s) => s.id === editingId.value);
      if (idx !== -1) schedules.value[idx] = response.data.schedule;
      showToast('Schedule updated', 'success');
    } else {
      const response = await axios.post('/schedule', payload);
      schedules.value.unshift(response.data.schedule);
      showToast('Schedule created', 'success');
    }

    closeModal();
  } catch (err) {
    formError.value = err.response?.data?.error || 'Failed to save schedule';
  } finally {
    saving.value = false;
  }
}

async function toggleSchedule(schedule) {
  try {
    const response = await axios.patch(`/schedule/${schedule.id}/toggle`);
    const idx = schedules.value.findIndex((s) => s.id === schedule.id);
    if (idx !== -1) schedules.value[idx] = response.data.schedule;
    showToast(
      response.data.schedule.active ? 'Schedule activated' : 'Schedule paused',
      'info'
    );
  } catch (err) {
    showToast('Failed to toggle schedule', 'error');
  }
}

function deleteSchedule(schedule) {
  deletingId.value = schedule.id;
}

async function confirmDelete() {
  if (!deletingId.value) return;
  deleting.value = true;
  try {
    await axios.delete(`/schedule/${deletingId.value}`);
    schedules.value = schedules.value.filter((s) => s.id !== deletingId.value);
    showToast('Schedule deleted', 'info');
    deletingId.value = null;
  } catch (err) {
    showToast('Failed to delete schedule', 'error');
  } finally {
    deleting.value = false;
  }
}

onMounted(() => {
  loadSchedules();
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
  transform: scale(0.96);
}
</style>
