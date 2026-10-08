import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const read = (p: string) => readFileSync(`dist${p}`, 'utf8');

describe('feeds and metadata', () => {
  it('feed.xml lists 31 posts with https links and no drafts', () => {
    const xml = read('/feed.xml');
    expect((xml.match(/<item>/g) ?? []).length).toBe(31);
    expect(xml).toContain('<link>https://sysadminas.eu/AKS-Issue-Analyzer-Claude-Skill/</link>');
    expect(xml).not.toContain('Part-11-AKS');
  });
  it('sitemap.xml points at the generated sitemap and excludes drafts', () => {
    expect(read('/sitemap.xml')).toContain('https://sysadminas.eu/sitemap-0.xml');
    const sm = read('/sitemap-0.xml');
    expect(sm).toContain('https://sysadminas.eu/Part-1-AKS/');
    expect(sm).not.toContain('Part-11-AKS');
  });
  it('robots.txt references the sitemap', () => {
    expect(read('/robots.txt')).toContain('Sitemap: https://sysadminas.eu/sitemap-index.xml');
  });
  it('GoatCounter script is present', () => {
    expect(read('/index.html')).toContain('data-goatcounter="https://sysadminas.goatcounter.com/count"');
  });
});
