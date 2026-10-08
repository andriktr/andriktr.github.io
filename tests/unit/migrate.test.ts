import { describe, it, expect } from 'vitest';
import { parseLegacyDate, normaliseTag, slugFromFilename, transformFrontmatter } from '../../scripts/lib/migrate.mjs';

describe('migration helpers', () => {
  it('parses Jekyll text dates to ISO', () => {
    expect(parseLegacyDate('August 02, 2019')).toBe('2019-08-02');
    expect(parseLegacyDate('May 19, 2026')).toBe('2026-05-19');
  });
  it('keeps filename slug case', () => {
    expect(slugFromFilename('2019-09-26-Part-1-AKS.md')).toBe('Part-1-AKS');
    expect(slugFromFilename('2024-08-xx-Part-11-AKS.md')).toBe('Part-11-AKS');
  });
  it('normalises tag aliases and whitespace', () => {
    expect(normaliseTag('K8S')).toBe('Kubernetes');
    expect(normaliseTag('Pod ')).toBe('Pod');
    expect(normaliseTag('Github')).toBe('GitHub');
    expect(normaliseTag('AzureDevOps')).toBe('Azure DevOps');
    expect(normaliseTag('Terraform')).toBe('Terraform');
    expect(normaliseTag('Keyvault')).toBe('KeyVault');
    expect(normaliseTag('kyverno')).toBe('Kyverno');
    expect(normaliseTag('Images')).toBe('Image');
  });
  it('transforms frontmatter and dedupes tags', () => {
    const out = transformFrontmatter(
      { title: 'T', excerpt: 'E', date: 'August 02, 2019', toc: true, toc_label: 'Content', toc_sticky: true, tags: ['K8S', 'Kubernetes', 'Azure'] },
      '2019-08-02-Part-1-Azure-SQL-DB-Backups.md', { draft: false });
    expect(out).toEqual({ title: 'T', excerpt: 'E', date: '2019-08-02', urlSlug: 'Part-1-Azure-SQL-DB-Backups', tags: ['Kubernetes', 'Azure'], toc: true, draft: false });
  });
});
