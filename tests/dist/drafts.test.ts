import { existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('drafts', () => {
  it('are not built in production', () => {
    expect(existsSync('dist/Part-11-AKS/index.html')).toBe(false);
  });
});
