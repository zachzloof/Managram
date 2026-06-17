<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white">Post Queue</h1>
        <p class="text-gray-400 text-sm mt-0.5">
          {{ queueStore.pendingCount }} pending •
          {{ queueStore.postedItems.length }} posted •
          {{ queueStore.failedItems.length }} failed
        </p>
      </div>
      <div class="flex gap-2">
        <button @click="queueStore.loadQueue()" class="btn-secondary">
          <ArrowPathIcon class="w-4 h-4" :class="queueStore.loading ? 'animate-spin' : ''" />
          Refresh
        </button>
        <RouterLink to="/compose" class="btn-primary">
          <PlusIcon class="w-4 h-4" />
          Add to Queue
        </RouterLink>
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="flex gap-2">
      <button
        v-for="tab in filterTabs"
        :key="tab.value"
        @click="activeFilter = tab.value"
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
        :class="activeFilter === tab.value
          ? 'bg-accent-500 text-white'
          : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'"
      >
        {{ tab.label }}
        <span v-if="tab.count" class="ml-1.5 text-xs opacity-70">{{ tab.count }}</span>
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="queueStore.loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-24 bg-gray-900 rounded-xl animate-pulse border border-white/5" />
    </div>

    <!-- Empty state -->
    <div v-else-if="filteredItems.length === 0" class="text-center py-16">
      <div class="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
        <QueueListIcon class="w-10 h-10 text-gray-700" />
      </div>
      <h3 class="text-white font-semibold text-lg mb-2">
        {{ activeFilter === 'all' ? 'Queue is empty' : `No ${activeFilter} posts` }}
      </h3>
      <p class="text-gray-400 text-sm max-w-sm mx-auto mb-6">
        Add posts to your queue from the Compose page or Library to schedule them for posting.
      </p>
      <RouterLink to="/compose" class="btn-primary">
        <PlusIcon class="w-4 h-4" />
        Compose a Post
      </RouterLink>
    </div>

    <!-- Queue list -->
    <div v-else class="space-y-3">
      <QueueItem
        v-for="item in filteredItems"
        :key="item.id"
        :item="item"
        @postNow="handlePostNow"
        @edit="handleEdit"
        @remove="handleRemove"
      />
    </div>

    <!-- Edit Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="editingItem"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="editingItem = null"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-4">Edit Queue Item</h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Caption</label>
                <textarea
                  v-model="editCaption"
                  placeholder="Write a caption..."
                  class="input-field resize-none"
                  rows="4"
                  maxlength="2200"
                />
                <p class="text-xs text-gray-600 text-right mt-1">{{ editCaption.length }}/2200</p>
              </div>

              <div>
                <label class="block text-sm text-gray-400 mb-1.5">Scheduled Time (optional)</label>
                <input
                  v-model="editScheduledAt"
                  type="datetime-local"
                  class="input-field"
                />
              </div>
            </div>

            <div class="flex gap-2 mt-6">
              <button @click="editingItem = null" class="btn-secondary flex-1">Cancel</button>
              <button @click="saveEdit" :disabled="savingEdit" class="btn-primary flex-1">
                <svg v-if="savingEdit" class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <CheckIcon v-else class="w-4 h-4" />
                {{ savingEdit ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Post Now Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="postNowItem"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          @click.self="postNowItem = null"
        >
          <div class="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 class="text-lg font-semibold text-white mb-4">Post Now</h3>
            <p class="text-gray-400 text-sm mb-6">
              Publish this post immediately to Instagram?
            </p>
            <div class="flex gap-2">
              <button @click="postNowItem = null" class="btn-secondary flex-1">Cancel</button>
              <button @click="confirmPostNow" :disabled="posting" class="btn-primary flex-1">
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
import { toUKDatetimeLocal } from '../utils/time.js';
import { RouterLink } from 'vue-router';
import axios from 'axios';
import {
  ArrowPathIcon,
  PlusIcon,
  QueueListIcon,
  CheckIcon,
  BoltIcon,
} from '@heroicons/vue/24/outline';
import QueueItem from '../components/QueueItem.vue';
import { useQueueStore } from '../stores/queue.js';

const showToast = inject('showToast');
const queueStore = useQueueStore();

const activeFilter = ref('all');
const editingItem = ref(null);
const editCaption = ref('');
const editScheduledAt = ref('');
const savingEdit = ref(false);
const postNowItem = ref(null);
const posting = ref(false);

const filterTabs = computed(() => [
  { label: 'All', value: 'all', count: queueStore.items.length },
  { label: 'Pending', value: 'pending', count: queueStore.pendingCount },
  { label: 'Posted', value: 'posted', count: queueStore.postedItems.length },
  { label: 'Failed', value: 'failed', count: queueStore.failedItems.length },
]);

const filteredItems = computed(() => {
  if (activeFilter.value === 'all') return queueStore.items;
  return queueStore.items.filter((i) => i.status === activeFilter.value);
});

function handleEdit(item) {
  editingItem.value = item;
  editCaption.value = item.caption || '';
  editScheduledAt.value = item.scheduled_at
    ? toUKDatetimeLocal(new Date(item.scheduled_at))
    : '';
}

async function saveEdit() {
  if (!editingItem.value) return;
  savingEdit.value = true;
  try {
    await queueStore.updateItem(editingItem.value.id, {
      caption: editCaption.value,
      scheduledAt: editScheduledAt.value || null,
    });
    showToast('Queue item updated', 'success');
    editingItem.value = null;
  } catch (err) {
    showToast(err.message || 'Failed to update', 'error');
  } finally {
    savingEdit.value = false;
  }
}

function handlePostNow(item) {
  postNowItem.value = item;
}

async function confirmPostNow() {
  if (!postNowItem.value) return;
  posting.value = true;
  try {
    await axios.post('/posts/publish', {
      mediaPath: postNowItem.value.media_path,
      caption: postNowItem.value.caption,
    });
    await queueStore.updateItem(postNowItem.value.id, { status: 'posted' });
    showToast('Post published successfully!', 'success');
    postNowItem.value = null;
    await queueStore.loadQueue();
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to publish', 'error');
  } finally {
    posting.value = false;
  }
}

async function handleRemove(item) {
  try {
    await queueStore.removeFromQueue(item.id);
    showToast('Removed from queue', 'info');
  } catch (err) {
    showToast(err.message || 'Failed to remove', 'error');
  }
}

onMounted(() => {
  queueStore.loadQueue();
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
