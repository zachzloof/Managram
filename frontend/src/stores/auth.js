import { defineStore } from 'pinia';
import axios from 'axios';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    isAuthenticated: false,
    loading: false,
    checked: false,
  }),

  actions: {
    async checkAuth() {
      this.loading = true;
      try {
        const response = await axios.get('/auth/status');
        this.isAuthenticated = response.data.authenticated;
        this.user = response.data.user;
      } catch (err) {
        this.isAuthenticated = false;
        this.user = null;
      } finally {
        this.loading = false;
        this.checked = true;
      }
    },

    async logout() {
      this.loading = true;
      try {
        await axios.post('/auth/logout');
        this.isAuthenticated = false;
        this.user = null;
      } catch (err) {
        // Still clear local state even if request fails
        this.isAuthenticated = false;
        this.user = null;
      } finally {
        this.loading = false;
      }
    },

    setAuth(user) {
      this.isAuthenticated = true;
      this.user = user;
      this.checked = true;
    },
  },
});
