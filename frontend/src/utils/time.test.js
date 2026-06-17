import { describe, it, expect } from 'vitest';
import { toUKDatetimeLocal } from './time.js';

describe('toUKDatetimeLocal', () => {
  it('formats a UTC winter date as London time (no DST offset)', () => {
    // 2025-01-15T10:30:00Z — January, UK is on GMT (UTC+0)
    const date = new Date('2025-01-15T10:30:00Z');
    expect(toUKDatetimeLocal(date)).toBe('2025-01-15T10:30');
  });

  it('formats a UTC summer date as London time (BST, UTC+1)', () => {
    // 2025-07-15T10:30:00Z — July, UK is on BST (UTC+1) — local clock reads 11:30
    const date = new Date('2025-07-15T10:30:00Z');
    expect(toUKDatetimeLocal(date)).toBe('2025-07-15T11:30');
  });

  it('zero-pads single-digit months, days, hours, and minutes', () => {
    const date = new Date('2025-03-02T05:04:00Z');
    expect(toUKDatetimeLocal(date)).toBe('2025-03-02T05:04');
  });

  it('produces a string usable directly as a datetime-local input value', () => {
    const date = new Date('2025-11-20T18:00:00Z');
    const result = toUKDatetimeLocal(date);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
