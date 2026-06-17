import { reactive } from 'vue';

// Lives outside any component so it's reachable from main.js's global error
// handler and the axios interceptor, not just from inside the Vue tree via
// inject('showToast') (which App.vue still provides, unchanged, for every
// existing component that already uses it).
export const toasts = reactive([]);

let toastId = 0;

export function pushToast(message, type = 'info', duration = 5000) {
  const id = ++toastId;
  toasts.push({ id, message, type });
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i !== -1) toasts.splice(i, 1);
  }, duration);
}
