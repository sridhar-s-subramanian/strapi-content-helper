import { describe, expect, it } from 'vitest';
import { VERSION } from './index.js';

describe('core', () => {
  it('exposes a version', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
