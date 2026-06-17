const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { execFileSync } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const contentId = require('./contentId');

// Real, valid JPEG/PNG/MP4 fixtures generated with the same ffmpeg binary the
// app itself bundles — not hand-crafted bytes, so a passing test here means
// the format actually round-trips in the real world, not just in theory.
// (This is how the use_metadata_tags / ffprobe-path bugs below were caught.)
let workDir;
let jpgPath, pngPath, mp4Path, gifPath;

beforeAll(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'managram-contentid-test-'));
  jpgPath = path.join(workDir, 'fixture.jpg');
  pngPath = path.join(workDir, 'fixture.png');
  mp4Path = path.join(workDir, 'fixture.mp4');
  gifPath = path.join(workDir, 'fixture.gif');

  execFileSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=red:s=4x4', '-frames:v', '1', jpgPath, '-loglevel', 'error']);
  execFileSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=4x4', '-frames:v', '1', pngPath, '-loglevel', 'error']);
  execFileSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=green:s=32x32:d=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mp4Path, '-loglevel', 'error']);
  execFileSync(ffmpegPath, ['-y', '-f', 'lavfi', '-i', 'color=c=yellow:s=4x4', '-frames:v', '1', gifPath, '-loglevel', 'error']);
}, 30000);

afterAll(() => {
  fs.removeSync(workDir);
});

function copyFixture(srcPath, ext) {
  const dest = path.join(workDir, `work-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  fs.copyFileSync(srcPath, dest);
  return dest;
}

describe('isStampable', () => {
  it('supports jpg, jpeg, png, mp4, mov', () => {
    expect(contentId.isStampable('.jpg')).toBe(true);
    expect(contentId.isStampable('.JPEG')).toBe(true);
    expect(contentId.isStampable('.png')).toBe(true);
    expect(contentId.isStampable('.mp4')).toBe(true);
    expect(contentId.isStampable('.mov')).toBe(true);
  });

  it('rejects gif and anything else', () => {
    expect(contentId.isStampable('.gif')).toBe(false);
    expect(contentId.isStampable('.txt')).toBe(false);
  });
});

describe('JPEG round trip', () => {
  it('mints an id and reads the same one back', async () => {
    const file = copyFixture(jpgPath, '.jpg');
    expect(await contentId.readContentId(file, '.jpg')).toBeNull();

    const id = await contentId.ensureContentId(file, '.jpg');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await contentId.readContentId(file, '.jpg')).toBe(id);
  });

  it('ensureContentId is idempotent — a second call returns the same id, not a new one', async () => {
    const file = copyFixture(jpgPath, '.jpg');
    const first = await contentId.ensureContentId(file, '.jpg');
    const second = await contentId.ensureContentId(file, '.jpg');
    expect(second).toBe(first);
  });
});

describe('PNG round trip', () => {
  it('mints an id and reads the same one back', async () => {
    const file = copyFixture(pngPath, '.png');
    expect(await contentId.readContentId(file, '.png')).toBeNull();

    const id = await contentId.ensureContentId(file, '.png');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await contentId.readContentId(file, '.png')).toBe(id);
  });

  it('produces a file that is still a valid PNG afterward', async () => {
    const file = copyFixture(pngPath, '.png');
    await contentId.ensureContentId(file, '.png');
    const buf = fs.readFileSync(file);
    expect(buf.slice(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });
});

describe('MP4 round trip', () => {
  it('mints an id and reads the same one back', async () => {
    const file = copyFixture(mp4Path, '.mp4');
    expect(await contentId.readContentId(file, '.mp4')).toBeNull();

    const id = await contentId.ensureContentId(file, '.mp4');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await contentId.readContentId(file, '.mp4')).toBe(id);
  }, 15000);
});

describe('unsupported formats', () => {
  it('ensureContentId returns null for gif without throwing or touching the file', async () => {
    const file = copyFixture(gifPath, '.gif');
    const before = fs.readFileSync(file);
    const id = await contentId.ensureContentId(file, '.gif');
    expect(id).toBeNull();
    const after = fs.readFileSync(file);
    expect(after).toEqual(before);
  });
});

describe('graceful degradation', () => {
  it('ensureContentId returns null instead of throwing when the file does not exist', async () => {
    const missing = path.join(workDir, 'does-not-exist.jpg');
    await expect(contentId.ensureContentId(missing, '.jpg')).resolves.toBeNull();
  });
});

describe('metadataOutputOptions', () => {
  it('includes the use_metadata_tags movflag and the id under the expected key', () => {
    const opts = contentId.metadataOutputOptions('some-id');
    expect(opts).toContain('-movflags');
    expect(opts).toContain('+use_metadata_tags');
    expect(opts).toContain(`${contentId.TAG_KEY}=some-id`);
  });
});
