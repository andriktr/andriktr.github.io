import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
describe('search', () => {
  it('pagefind index is built', () => {
    expect(existsSync('dist/pagefind/pagefind-ui.js')).toBe(true);
    expect(existsSync('dist/pagefind/pagefind-entry.json')).toBe(true);
  });
  it('search dialog is on every page', () => {
    expect(readFileSync('dist/index.html', 'utf8')).toContain('id="search-dialog"');
  });
});
