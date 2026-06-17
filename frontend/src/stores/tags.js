import { defineStore } from 'pinia';
import axios from 'axios';

export const useTagsStore = defineStore('tags', {
  state: () => ({
    tags: [],
    loaded: false,
    loading: false,
  }),

  actions: {
    async loadTags() {
      this.loading = true;
      try {
        const response = await axios.get('/tags');
        this.tags = response.data;
        this.loaded = true;
      } catch (err) {
        console.error('Failed to load tags:', err.message);
      } finally {
        this.loading = false;
      }
    },

    async createTag(name, color) {
      const response = await axios.post('/tags', { name, color });
      this.tags.push(response.data);
      return response.data;
    },

    async deleteTag(id) {
      await axios.delete(`/tags/${id}`);
      this.tags = this.tags.filter((t) => t.id !== id);
    },

    async assignTag(subpath, tagId) {
      const response = await axios.post('/tags/assign', { subpath, tagId });
      return response.data;
    },

    async unassignTag(subpath, tagId) {
      await axios.post('/tags/unassign', { subpath, tagId });
    },
  },
});
