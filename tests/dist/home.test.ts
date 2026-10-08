import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const count = (html: string) => (html.match(/class="post-row"/g) ?? []).length;

describe('home + pagination', () => {
  it('home shows whoami and the 5 newest posts', () => {
    const html = readFileSync('dist/index.html', 'utf8');
    expect(html).toContain('whoami');
    expect(count(html)).toBe(5);
    expect(html).toContain('href="/AKS-Issue-Analyzer-Claude-Skill/"');
  });
  it('emits /page2/ … /page7/ and no /page8/ or /page1/', () => {
    for (let n = 2; n <= 7; n++) expect(existsSync(`dist/page${n}/index.html`), `page${n}`).toBe(true);
    expect(existsSync('dist/page8/index.html')).toBe(false);
    expect(existsSync('dist/page1/index.html')).toBe(false);
  });
  it('last page holds the remainder (31 = 6*5 + 1)', () => {
    expect(count(readFileSync('dist/page7/index.html', 'utf8'))).toBe(1);
  });
});
