import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

describe('internal links and images', () => {
  it('every root-relative href/src in dist resolves to a file', () => {
    const missing = new Set<string>();
    for (const file of walk('dist').filter((f) => f.endsWith('.html'))) {
      const html = readFileSync(file, 'utf8');
      for (const m of html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) {
        if (m[1].startsWith('//')) continue;
        let path = decodeURIComponent(m[1].replace(/[#?].*$/, ''));
        if (!path || path === '/') path = '/index.html';
        else if (path.endsWith('/')) path += 'index.html';
        if (!existsSync(join('dist', path)) && !existsSync(join('dist', path, 'index.html'))) missing.add(`${path} (in ${file})`);
      }
    }
    expect([...missing], `missing targets:\n${[...missing].join('\n')}`).toEqual([]);
  });
});
