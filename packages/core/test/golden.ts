/**
 * Tiny file-based golden helper. Writes the golden on first run or when
 * `UPDATE_GOLDENS=1`, otherwise asserts the value matches the committed file.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { expect } from 'vitest';

export function assertGolden(goldenPath: string, actual: string): void {
  const shouldUpdate = process.env.UPDATE_GOLDENS === '1' || !existsSync(goldenPath);
  if (shouldUpdate) {
    mkdirSync(dirname(goldenPath), { recursive: true });
    writeFileSync(goldenPath, actual);
    return;
  }
  const expected = readFileSync(goldenPath, 'utf8');
  expect(actual, `golden mismatch: ${goldenPath} (run with UPDATE_GOLDENS=1 to refresh)`).toBe(
    expected,
  );
}
