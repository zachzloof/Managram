import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import axios from 'axios';
import { useAccountStore } from './account.js';

vi.mock('axios');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

// checkAccount() leans on the exact HTTP status /account/me returns to tell
// apart three situations that look similar from the outside: "this is a
// local/Electron install" (404 — /account/* doesn't exist there at all),
// "hosted, but not logged in or lapsed" (401/402), and "hosted, logged in"
// (200). Getting this branch wrong would either show the account gate to
// local users who should never see it, or skip it for hosted users who need it.
describe('useAccountStore.checkAccount', () => {
  it('detects a local install via 404 and never shows the hosted gate', async () => {
    axios.get.mockRejectedValue({ response: { status: 404 } });
    const store = useAccountStore();

    await store.checkAccount();

    expect(store.hostedMode).toBe(false);
    expect(store.authenticated).toBe(false);
    expect(store.checked).toBe(true);
  });

  it('detects hosted mode when not logged in (401) and requires login', async () => {
    axios.get.mockRejectedValue({ response: { status: 401 } });
    const store = useAccountStore();

    await store.checkAccount();

    expect(store.hostedMode).toBe(true);
    expect(store.authenticated).toBe(false);
  });

  it('detects hosted mode with a lapsed subscription (402) and requires login', async () => {
    axios.get.mockRejectedValue({ response: { status: 402 } });
    const store = useAccountStore();

    await store.checkAccount();

    expect(store.hostedMode).toBe(true);
    expect(store.authenticated).toBe(false);
  });

  it('detects hosted mode and an authenticated account on success', async () => {
    axios.get.mockResolvedValue({ data: { account: { id: 'a1', email: 'a@b.com', status: 'active' } } });
    const store = useAccountStore();

    await store.checkAccount();

    expect(store.hostedMode).toBe(true);
    expect(store.authenticated).toBe(true);
    expect(store.account).toEqual({ id: 'a1', email: 'a@b.com', status: 'active' });
  });

  it('always sets checked=true, even when the request throws with no response object', async () => {
    axios.get.mockRejectedValue(new Error('network error, no response'));
    const store = useAccountStore();

    await store.checkAccount();

    expect(store.checked).toBe(true);
    // No response.status at all is treated as "hosted, not logged in" rather
    // than silently crashing — conservative default, not local-mode (which
    // would skip the gate and could expose a hosted deployment).
    expect(store.hostedMode).toBe(true);
    expect(store.authenticated).toBe(false);
  });
});

describe('useAccountStore.login / signup / logout', () => {
  it('login sets authenticated + account on success', async () => {
    axios.post.mockResolvedValue({ data: { account: { id: 'a1', email: 'a@b.com' } } });
    const store = useAccountStore();

    await store.login('a@b.com', 'password123');

    expect(axios.post).toHaveBeenCalledWith('/account/login', { email: 'a@b.com', password: 'password123' });
    expect(store.authenticated).toBe(true);
    expect(store.account.email).toBe('a@b.com');
  });

  it('logout clears authenticated + account', async () => {
    axios.post.mockResolvedValue({ data: {} });
    const store = useAccountStore();
    store.authenticated = true;
    store.account = { id: 'a1' };

    await store.logout();

    expect(axios.post).toHaveBeenCalledWith('/account/logout');
    expect(store.authenticated).toBe(false);
    expect(store.account).toBeNull();
  });
});
