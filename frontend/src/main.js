import { createApp } from 'vue';
import { createPinia } from 'pinia';
import axios from 'axios';
import App from './App.vue';
import router from './router/index.js';
import { pushToast } from './utils/toast.js';
import './style.css';

// Safety net for any API call that doesn't already handle its own error —
// logs full detail to the console either way, and appends the backend's
// debug code to the message in place, so every existing
// `err.response?.data?.error` call site picks up the code for free without
// needing to be touched individually.
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const data = error.response?.data;
    console.error('[API Error]', error.config?.method?.toUpperCase(), error.config?.url, error.response?.status, data || error.message);
    if (data?.error && data?.code) {
      data.error = `${data.error} (${data.code})`;
    }
    return Promise.reject(error);
  }
);

// Catches errors Vue itself surfaces from component render/lifecycle code —
// without this, a bug in a component could just leave a blank or frozen
// screen with nothing in the UI to explain why.
const app = createApp(App);
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]', info, err);
  pushToast('Something went wrong on this screen. Check the console for details, or restart if it seems stuck.', 'error', 8000);
};

// Catches anything else that slips through — a rejected promise nobody
// awaited, or a plain JS error outside Vue's own handling.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason);
  pushToast('An unexpected error occurred. Check the console for details.', 'error', 8000);
});

window.addEventListener('error', (event) => {
  console.error('[Window Error]', event.error || event.message);
  pushToast('An unexpected error occurred. Check the console for details.', 'error', 8000);
});

const pinia = createPinia();

app.use(pinia);
app.use(router);

app.mount('#app');
