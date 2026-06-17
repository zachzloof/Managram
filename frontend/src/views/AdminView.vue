<template>
  <div class="p-6 space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-white">Admin</h1>
      <p class="text-gray-400 text-sm mt-0.5">Every customer account, and manual access control</p>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
            <th class="pb-2 pr-4">Email</th>
            <th class="pb-2 pr-4">Plan</th>
            <th class="pb-2 pr-4">Status</th>
            <th class="pb-2 pr-4">Override</th>
            <th class="pb-2 pr-4">Joined</th>
            <th class="pb-2"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in accounts" :key="a.id" class="border-b border-white/5">
            <td class="py-2.5 pr-4 text-white">{{ a.email }} <span v-if="a.isAdmin" class="text-accent-400 text-xs">(admin)</span></td>
            <td class="py-2.5 pr-4 text-gray-300">{{ a.plan }}</td>
            <td class="py-2.5 pr-4">
              <span class="badge" :class="statusBadge(a.status)">{{ a.status }}</span>
            </td>
            <td class="py-2.5 pr-4 text-gray-400">{{ a.override || '—' }}</td>
            <td class="py-2.5 pr-4 text-gray-500 text-xs">{{ formatDate(a.createdAt) }}</td>
            <td class="py-2.5 text-right">
              <button
                v-if="a.override !== 'force_deny'"
                @click="setOverride(a, 'force_deny')"
                class="text-xs text-red-400 hover:text-red-300 transition-colors mr-3"
              >Revoke</button>
              <button
                v-if="a.override"
                @click="setOverride(a, null)"
                class="text-xs text-gray-400 hover:text-white transition-colors mr-3"
              >Clear override</button>
              <button
                v-if="a.override !== 'force_allow'"
                @click="setOverride(a, 'force_allow')"
                class="text-xs text-accent-400 hover:text-accent-300 transition-colors"
              >Force allow</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="accounts.length === 0" class="text-center text-gray-500 text-sm py-8">No accounts yet</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, inject } from 'vue';
import axios from 'axios';

const showToast = inject('showToast');
const accounts = ref([]);

function statusBadge(status) {
  if (status === 'active' || status === 'trialing') return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25';
  if (status === 'past_due') return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/25';
  return 'bg-red-500/10 text-red-400 border border-red-500/25';
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function load() {
  try {
    const response = await axios.get('/admin/accounts');
    accounts.value = response.data.accounts;
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to load accounts', 'error');
  }
}

async function setOverride(account, override) {
  try {
    await axios.post(`/admin/accounts/${account.id}/override`, { override });
    account.override = override;
    showToast('Updated', 'success');
  } catch (err) {
    showToast(err.response?.data?.error || 'Failed to update', 'error');
  }
}

onMounted(load);
</script>
