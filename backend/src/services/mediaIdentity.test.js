// Unit tests for the orchestration logic in mediaIdentity.js — database.js,
// r2.js, and the contentId file-stamping utility are all mocked here so
// this suite never touches a real SQLite file or ffmpeg, and runs anywhere
// (including environments where better-sqlite3's native binary doesn't
// match the installed Node version — see README "Running tests").
//
// Note: mediaIdentity.js destructures the database.js functions at require
// time (`const { getSetting, ... } = require('../database')`), so mocking
// must mutate the *same* jest.fn() instances via .mockReturnValue/
// .mockImplementation rather than reassigning `database.foo = jest.fn()`
// (which would create a new function object the already-destructured local
// binding inside mediaIdentity.js never sees).

jest.mock('../database');
jest.mock('./r2');
jest.mock('../utils/contentId');

const path = require('path');
const fsExtra = require('fs-extra'); // the exact module mediaIdentity.js itself requires
const database = require('../database');
const r2 = require('./r2');
const contentIdUtil = require('../utils/contentId');
const mediaIdentity = require('./mediaIdentity');

// This unit test is about the resolveContentId/cache orchestration, not real
// file I/O (the R2 download/upload/cleanup plumbing is pre-existing code
// shared with /media/trim and /media/crop) — stub the filesystem calls on
// the *exact* fs-extra instance mediaIdentity.js requires so a fake path
// doesn't throw, without faking the orchestration logic itself.
jest.spyOn(fsExtra, 'createReadStream').mockReturnValue({});
jest.spyOn(fsExtra, 'unlink').mockImplementation((_, cb) => cb && cb());

beforeEach(() => {
  jest.clearAllMocks();
  database.getSetting.mockReturnValue('C:\\content');
  database.getIdentityBySubpath.mockReturnValue(null);
  database.getIdentitiesBySubpaths.mockReturnValue({});
  r2.isR2Mode.mockReturnValue(false);
  r2.downloadToTemp.mockResolvedValue('C:\\fake\\downloaded.mp4');
  r2.uploadStream.mockResolvedValue(undefined);
  contentIdUtil.isStampable.mockReturnValue(true);
  contentIdUtil.readContentId.mockResolvedValue(null);
  contentIdUtil.writeContentId.mockResolvedValue(undefined);
});

describe('toSubpath', () => {
  it('returns the key unchanged in R2 mode', () => {
    r2.isR2Mode.mockReturnValue(true);
    expect(mediaIdentity.toSubpath('folder/video.mp4')).toBe('folder/video.mp4');
  });

  it('computes a forward-slashed relative path in local mode', () => {
    const abs = path.join('C:\\content', 'sub', 'video.mp4');
    expect(mediaIdentity.toSubpath(abs)).toBe('sub/video.mp4');
  });
});

describe('resolveContentId', () => {
  it('returns null for unsupported formats without touching the cache', async () => {
    contentIdUtil.isStampable.mockReturnValue(false);
    const id = await mediaIdentity.resolveContentId('C:\\content\\meme.gif');
    expect(id).toBeNull();
    expect(database.getIdentityBySubpath).not.toHaveBeenCalled();
  });

  it('returns the cached id without reading or writing the file', async () => {
    database.getIdentityBySubpath.mockReturnValue({ content_id: 'cached-id' });
    const id = await mediaIdentity.resolveContentId('C:\\content\\video.mp4');
    expect(id).toBe('cached-id');
    expect(contentIdUtil.readContentId).not.toHaveBeenCalled();
    expect(contentIdUtil.writeContentId).not.toHaveBeenCalled();
  });

  it('reuses an id already embedded in the file instead of minting a new one', async () => {
    contentIdUtil.readContentId.mockResolvedValue('already-embedded-id');
    const id = await mediaIdentity.resolveContentId('C:\\content\\video.mp4');
    expect(id).toBe('already-embedded-id');
    expect(contentIdUtil.writeContentId).not.toHaveBeenCalled();
    expect(database.upsertIdentity).toHaveBeenCalledWith('local', 'already-embedded-id', 'video.mp4');
  });

  it('mints and writes a fresh id when the file has none and nothing is cached', async () => {
    const id = await mediaIdentity.resolveContentId('C:\\content\\video.mp4');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(contentIdUtil.writeContentId).toHaveBeenCalledWith('C:\\content\\video.mp4', '.mp4', id);
    expect(database.upsertIdentity).toHaveBeenCalledWith('local', id, 'video.mp4');
  });

  it('falls back to null instead of throwing when writing fails', async () => {
    contentIdUtil.writeContentId.mockImplementation(() => {
      throw new Error('disk full');
    });
    await expect(mediaIdentity.resolveContentId('C:\\content\\video.mp4')).resolves.toBeNull();
  });

  it('in R2 mode, downloads to a temp file, stamps it, and re-uploads under the same key', async () => {
    r2.isR2Mode.mockReturnValue(true);

    const id = await mediaIdentity.resolveContentId('folder/video.mp4', 'acct-1');

    expect(r2.downloadToTemp).toHaveBeenCalledWith('folder/video.mp4');
    expect(contentIdUtil.writeContentId).toHaveBeenCalledWith('C:\\fake\\downloaded.mp4', '.mp4', id);
    expect(r2.uploadStream).toHaveBeenCalled();
    const [uploadedKey] = r2.uploadStream.mock.calls[0];
    expect(uploadedKey).toBe('folder/video.mp4');
    expect(database.upsertIdentity).toHaveBeenCalledWith('acct-1', id, 'folder/video.mp4');
  });
});

describe('peekContentId', () => {
  it('never calls writeContentId, even when the file has no embedded id', async () => {
    const id = await mediaIdentity.peekContentId('C:\\content\\video.mp4');
    expect(id).toBeNull();
    expect(contentIdUtil.writeContentId).not.toHaveBeenCalled();
  });

  it('returns whatever the file already has embedded', async () => {
    contentIdUtil.readContentId.mockResolvedValue('existing-id');
    const id = await mediaIdentity.peekContentId('C:\\content\\video.mp4');
    expect(id).toBe('existing-id');
  });

  it('returns null for unsupported formats', async () => {
    contentIdUtil.isStampable.mockReturnValue(false);
    expect(await mediaIdentity.peekContentId('C:\\content\\meme.gif')).toBeNull();
  });
});

describe('relinkIdentity', () => {
  it('does nothing when there is no existing id (no-op, no DB write)', () => {
    mediaIdentity.relinkIdentity('local', null, 'C:\\content\\new.mp4');
    expect(database.upsertIdentity).not.toHaveBeenCalled();
  });

  it('points the cache at the new subpath when an id is given', () => {
    mediaIdentity.relinkIdentity('local', 'some-id', 'C:\\content\\renamed.mp4');
    expect(database.upsertIdentity).toHaveBeenCalledWith('local', 'some-id', 'renamed.mp4');
  });
});

describe('relinkBySubpathIfCached', () => {
  it('does nothing when the old subpath was never cached (file never touched)', () => {
    mediaIdentity.relinkBySubpathIfCached('local', 'C:\\content\\old.mp4', 'C:\\content\\new.mp4');
    expect(database.upsertIdentity).not.toHaveBeenCalled();
  });

  it('relinks the cached id to the new subpath, with zero file I/O', () => {
    database.getIdentityBySubpath.mockReturnValue({ content_id: 'cached-id' });
    mediaIdentity.relinkBySubpathIfCached('local', 'C:\\content\\old.mp4', 'C:\\content\\new.mp4');
    expect(database.upsertIdentity).toHaveBeenCalledWith('local', 'cached-id', 'new.mp4');
    expect(contentIdUtil.readContentId).not.toHaveBeenCalled();
    expect(contentIdUtil.writeContentId).not.toHaveBeenCalled();
  });
});

describe('recordPublishedPost', () => {
  it('resolves the content id and writes a post_history row', async () => {
    const result = await mediaIdentity.recordPublishedPost({
      mediaPathOrKey: 'C:\\content\\video.mp4',
      instagramPostId: 'ig-123',
      mediaType: 'VIDEO',
      caption: 'hello world',
      accountId: 'acct-1',
    });

    expect(result.contentId).toMatch(/^[0-9a-f-]{36}$/);
    expect(database.insertPostHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: 'acct-1',
        contentId: result.contentId,
        instagramPostId: 'ig-123',
        mediaType: 'VIDEO',
        caption: 'hello world',
        subpath: 'video.mp4',
      })
    );
  });

  it('still records history (with a null content id) when the file type is unstampable', async () => {
    contentIdUtil.isStampable.mockReturnValue(false);
    const result = await mediaIdentity.recordPublishedPost({
      mediaPathOrKey: 'C:\\content\\clip.gif',
      instagramPostId: 'ig-456',
      mediaType: 'IMAGE',
      caption: '',
    });
    expect(result.contentId).toBeNull();
    expect(database.insertPostHistory).toHaveBeenCalledWith(expect.objectContaining({ contentId: null }));
  });
});
