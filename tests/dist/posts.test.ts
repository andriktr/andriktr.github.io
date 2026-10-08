import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SLUGS = readFileSync('scripts/legacy-urls.txt', 'utf8').split('\n')
  .map((l) => l.trim()).filter((l) => /^\/[A-Z][\w-]*\/$/.test(l) || /^\/(CKA|CKAD|DPM-Impovements)\/$/.test(l));
const page = (p: string) => readFileSync(`dist${p}index.html`, 'utf8');
const allHtml = (dir = 'dist'): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? allHtml(p) : p.endsWith('.html') ? [p] : [];
});

describe('post pages', () => {
  it('exist for all 31 legacy slugs (case preserved)', () => {
    expect(SLUGS.length).toBe(31);
    for (const s of SLUGS) expect(existsSync(`dist${s}index.html`), s).toBe(true);
  });
  it('render {{ }} in code literally', () => {
    expect(page('/GitOps-with-Flux-and-Helm/')).toContain('{{');
    expect(page('/Host-Trivy-DB-in-ACR/')).toContain('{{');
  });
  it('render notices as asides', () => {
    expect(page('/Part-1-AKS/')).toContain('<aside class="notice notice--info"');
  });
  it('have no relative ../assets links anywhere', () => {
    for (const f of allHtml()) expect(readFileSync(f, 'utf8'), f).not.toContain('../assets/');
  });
  it('point images at files that exist', () => {
    const html = page('/Part-1-Azure-SQL-DB-Backups/');
    expect(html).toContain('src="/assets/images/post1/azure-sql.jpg"');
    expect(existsSync('dist/assets/images/post1/azure-sql.jpg')).toBe(true);
  });
  it('show a sticky TOC and code language labels', () => {
    const html = page('/AKS-Issue-Analyzer-Claude-Skill/');
    expect(html).toContain('class="toc"');
    expect(html).toMatch(/<pre[^>]*data-language="bash"/);
  });
  it('mark article body for search indexing', () => {
    expect(page('/Part-1-AKS/')).toContain('data-pagefind-body');
  });
});
