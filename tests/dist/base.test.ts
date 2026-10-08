import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const html = () => readFileSync('dist/index.html', 'utf8');
// Astro inlines small stylesheets, so read both emitted files and inline <style> blocks.
const css = () => {
  const files = existsSync('dist/_astro')
    ? readdirSync('dist/_astro').filter(f => f.endsWith('.css')).map(f => readFileSync(`dist/_astro/${f}`, 'utf8'))
    : [];
  const inline = [...html().matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  return [...files, ...inline].join('\n');
};

describe('Base layout', () => {
  it('sets the theme before paint and survives blocked storage', () => {
    expect(html()).toMatch(/<script>[^<]*try\s*\{[^<]*localStorage/);
  });
  it('defaults to dark tokens on :root without data-theme', () => {
    expect(css()).toMatch(/:root\{[^}]*--bg:#0b0f0c/);
  });
  it('renders nav with a downloadable CV link', () => {
    expect(html()).toMatch(/href="\/assets\/docs\/cv-andrej-trusevic\.pdf"[^>]*download/);
  });
  it('links an SVG favicon that exists', () => {
    expect(html()).toMatch(/<link rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
    expect(existsSync('dist/favicon.svg')).toBe(true);
  });
  it('has canonical url', () => {
    expect(html()).toContain('<link rel="canonical" href="https://sysadminas.eu/"');
  });
});
