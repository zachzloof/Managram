import { defineStore } from 'pinia';
import axios from 'axios';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    contentFolder: '',
    openaiKey: '',
    publicUrl: '',
    appId: '',
    appSecret: '',
    instagramUsername: '',
    instagramProfilePicture: '',
    loading: false,
    error: null,
  }),

  actions: {
    async loadSettings() {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.get('/settings');
        const s = response.data.settings;
        this.contentFolder = s.content_folder_path || '';
        this.openaiKey = s.openai_api_key || '';
        this.publicUrl = s.public_url || '';
        this.appId = s.app_id || '';
        this.appSecret = s.app_secret || '';
        this.instagramUsername = s.instagram_username || '';
        this.instagramProfilePicture = s.instagram_profile_picture || '';
      } catch (err) {
        this.error = err.response?.data?.error || err.message;
      } finally {
        this.loading = false;
      }
    },

    async saveSettings(updates) {
      this.loading = true;
      this.error = null;
      try {
        await axios.post('/settings', updates);
        // Update local state
        if (updates.content_folder_path !== undefined) this.contentFolder = updates.content_folder_path;
        if (updates.openai_api_key !== undefined && !updates.openai_api_key.includes('••••')) {
          this.openaiKey = updates.openai_api_key;
        }
        if (updates.public_url !== undefined) this.publicUrl = updates.public_url;
        if (updates.app_id !== undefined) this.appId = updates.app_id;
        if (updates.app_secret !== undefined && !updates.app_secret.includes('••••')) {
          this.appSecret = updates.app_secret;
        }
        return { success: true };
      } catch (err) {
        this.error = err.response?.data?.error || err.message;
        throw err;
      } finally {
        this.loading = false;
      }
    },
  },
});
