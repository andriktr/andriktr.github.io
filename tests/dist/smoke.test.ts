import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('build output', () => {
  it('emits index.html with the author name', () => {
    expect(existsSync('dist/index.html')).toBe(true);
    expect(readFileSync('dist/index.html', 'utf8')).toContain('Andrej Trusevic');
  });
});
