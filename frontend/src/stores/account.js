import { defineStore } from 'pinia';
import axios from 'axios';

// Only meaningful for the hosted (Railway, multi-tenant) deployment. In
// local/Electron mode every /account/* route 404s by design (see
// backend/src/routes/account.js hostedOnly guard) — that 404 is how the
// frontend detects "this is a local install, skip the account gate
// entirely" without needing a separate mode-detection endpoint.
export const useAccountStore = defineStore('account', {
  state: () => ({
    hostedMode: false,
    authenticated: false,
    account: null,
    checked: false,
  }),

  actions: {
    async checkAccount() {
      try {
        const response = await axios.get('/account/me');
        this.hostedMode = true;
        this.authenticated = true;
        this.account = response.data.account;
      } catch (err) {
        const status = err.response?.status;
        if (status === 404) {
          this.hostedMode = false;
          this.authenticated = false;
        } else {
          // 401 (not logged in) or 402 (lapsed subscription) — still hosted mode
          this.hostedMode = true;
          this.authenticated = false;
        }
      } finally {
        this.checked = true;
      }
    },

    async login(email, password) {
      const response = await axios.post('/account/login', { email, password });
      this.authenticated = true;
      this.account = response.data.account;
      return response.data;
    },

    async signup(email, password) {
      const response = await axios.post('/account/signup', { email, password });
      this.authenticated = true;
      this.account = response.data.account;
      return response.data;
    },

    async logout() {
      await axios.post('/account/logout');
      this.authenticated = false;
      this.account = null;
    },
  },
});
