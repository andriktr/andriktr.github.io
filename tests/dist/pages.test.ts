import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const read = (p: string) => readFileSync(`dist${p}`, 'utf8');

describe('secondary pages', () => {
  it('tags index keeps legacy anchors', () => {
    const html = read('/tags/index.html');
    for (const id of ['kubernetes', 'aks', 'claude-code', 'ci-cd']) expect(html).toContain(`id="${id}"`);
  });
  it('tags index keeps aliased legacy anchors', () => {
    const html = read('/tags/index.html');
    for (const id of ['k8s', 'aad', 'azuread', 'ado', 'azuredevops', 'fluxcd', 'golang', 'charts', 'container', 'db', 'argo', 'aqua', 'kube-node_shell']) expect(html, id).toContain(`id="${id}"`);
  });
  it('per-tag pages exist', () => {
    expect(existsSync('dist/tags/kubernetes/index.html')).toBe(true);
    expect(existsSync('dist/tags/ci-cd/index.html')).toBe(true);
  });
  it('year archive groups by year', () => {
    const html = read('/year-archive/index.html');
    expect(html).toContain('2026'); expect(html).toContain('2019');
  });
  it('about mentions agentic AI and links AI posts', () => {
    const html = read('/about/index.html');
    expect(html).toMatch(/agentic AI/i);
    expect(html).toContain('href="/AI-Agents-and-Helm-Chart-Upgrades/"');
  });
  it('certifications renders 18 badges and loads Credly once', () => {
    const html = read('/certifications/index.html');
    expect((html.match(/data-share-badge-id=/g) ?? []).length).toBe(18);
    expect((html.match(/credly\.com\/assets\/utilities\/embed\.js/g) ?? []).length).toBe(1);
  });
  it('404 page exists', () => {
    expect(read('/404.html')).toContain('command not found');
  });
});
