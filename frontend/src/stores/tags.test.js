import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import axios from 'axios';
import { useTagsStore } from './tags.js';

vi.mock('axios');

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
});

describe('useTagsStore', () => {
  it('loadTags populates tags and sets loaded', async () => {
    axios.get.mockResolvedValue({ data: [{ id: 1, name: 'funny', color: '#f5610c' }] });
    const store = useTagsStore();

    expect(store.loaded).toBe(false);
    await store.loadTags();

    expect(axios.get).toHaveBeenCalledWith('/tags');
    expect(store.tags).toEqual([{ id: 1, name: 'funny', color: '#f5610c' }]);
    expect(store.loaded).toBe(true);
  });

  it('loadTags does not throw when the request fails, and leaves tags empty', async () => {
    axios.get.mockRejectedValue(new Error('network down'));
    const store = useTagsStore();

    await expect(store.loadTags()).resolves.toBeUndefined();
    expect(store.tags).toEqual([]);
  });

  it('createTag posts the new tag and appends it to local state', async () => {
    axios.post.mockResolvedValue({ data: { id: 2, name: 'dnb', color: '#3b82f6' } });
    const store = useTagsStore();

    const created = await store.createTag('dnb', '#3b82f6');

    expect(axios.post).toHaveBeenCalledWith('/tags', { name: 'dnb', color: '#3b82f6' });
    expect(created).toEqual({ id: 2, name: 'dnb', color: '#3b82f6' });
    expect(store.tags).toContainEqual({ id: 2, name: 'dnb', color: '#3b82f6' });
  });

  it('deleteTag removes the tag from local state only after the request succeeds', async () => {
    const store = useTagsStore();
    store.tags = [{ id: 1, name: 'funny', color: '#f5610c' }, { id: 2, name: 'dnb', color: '#3b82f6' }];
    axios.delete.mockResolvedValue({ data: { success: true } });

    await store.deleteTag(1);

    expect(axios.delete).toHaveBeenCalledWith('/tags/1');
    expect(store.tags).toEqual([{ id: 2, name: 'dnb', color: '#3b82f6' }]);
  });

  it('deleteTag leaves local state untouched if the request fails', async () => {
    const store = useTagsStore();
    store.tags = [{ id: 1, name: 'funny', color: '#f5610c' }];
    axios.delete.mockRejectedValue(new Error('forbidden'));

    await expect(store.deleteTag(1)).rejects.toThrow('forbidden');
    expect(store.tags).toEqual([{ id: 1, name: 'funny', color: '#f5610c' }]);
  });

  it('assignTag and unassignTag call the expected endpoints with subpath + tagId', async () => {
    axios.post.mockResolvedValue({ data: { success: true, contentId: 'abc' } });
    const store = useTagsStore();

    await store.assignTag('folder/video.mp4', 5);
    expect(axios.post).toHaveBeenCalledWith('/tags/assign', { subpath: 'folder/video.mp4', tagId: 5 });

    await store.unassignTag('folder/video.mp4', 5);
    expect(axios.post).toHaveBeenCalledWith('/tags/unassign', { subpath: 'folder/video.mp4', tagId: 5 });
  });
});
