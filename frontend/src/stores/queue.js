import { defineStore } from 'pinia';
import axios from 'axios';

export const useQueueStore = defineStore('queue', {
  state: () => ({
    items: [],
    loading: false,
    error: null,
  }),

  getters: {
    pendingItems: (state) => state.items.filter((i) => i.status === 'pending'),
    postedItems: (state) => state.items.filter((i) => i.status === 'posted'),
    failedItems: (state) => state.items.filter((i) => i.status === 'failed'),
    pendingCount: (state) => state.items.filter((i) => i.status === 'pending').length,
  },

  actions: {
    async loadQueue() {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.get('/queue');
        this.items = response.data.items || [];
      } catch (err) {
        this.error = err.response?.data?.error || err.message;
      } finally {
        this.loading = false;
      }
    },

    async addToQueue(mediaPath, caption, scheduledAt = null) {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post('/queue', {
          mediaPath,
          caption,
          scheduledAt,
        });
        this.items.unshift(response.data.item);
        return response.data.item;
      } catch (err) {
        this.error = err.response?.data?.error || err.message;
        throw err;
      } finally {
        this.loading = false;
      }
    },

    async removeFromQueue(id) {
      try {
        await axios.delete(`/queue/${id}`);
        this.items = this.items.filter((item) => item.id !== id);
      } catch (err) {
        this.error = err.response?.data?.error || err.message;
        throw err;
      }
    },

    async updateItem(id, updates) {
      try {
        const response = await axios.patch(`/queue/${id}`, updates);
        const index = this.items.findIndex((item) => item.id === id);
        if (index !== -1) {
          this.items[index] = response.data.item;
        }
        return response.data.item;
      } catch (err) {
        this.error = err.response?.data?.error || err.message;
        throw err;
      }
    },

    async reorderQueue(orderedIds) {
      try {
        await axios.post('/queue/reorder', { orderedIds });
        // Reorder locally
        const idMap = new Map(this.items.map((item) => [item.id, item]));
        this.items = orderedIds.map((id) => idMap.get(id)).filter(Boolean);
      } catch (err) {
        this.error = err.response?.data?.error || err.message;
        throw err;
      }
    },
  },
});
