# sysadminas.eu Astro Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Jekyll/Minimal Mistakes site with a self-owned, terminal-styled Astro site on GitHub Pages without breaking any existing URL.

**Architecture:** Static Astro site. Posts live in a content collection with a validated schema and are rendered via a small remark plugin that translates legacy kramdown/Jekyll markup. Layout is `Base` (shell, nav, theme, search, analytics) → `Post` (article, sticky TOC, Giscus). A GitHub Actions workflow builds the site, indexes it with Pagefind, checks every legacy URL, and deploys it to Pages.

**Tech Stack:** Node 24, Astro 7.x, Shiki (bundled), `@astrojs/rss`, `@astrojs/sitemap`, Pagefind 1.x, Vitest 5.x, gray-matter + js-yaml (migration only), unified/remark (plugin tests).

**Spec:** `docs/superpowers/specs/2026-10-08-site-redesign-design.md`

## Global Constraints

- Branch `astro`. `master` (Jekyll) stays live and untouched until Task 11.
- `site: 'https://sysadminas.eu'`, `trailingSlash: 'always'`, `build.format: 'directory'`.
- Post URLs are `/<urlSlug>/`, where `urlSlug` is the Jekyll filename slug with **case preserved** (e.g. `Part-1-AKS`). Note that the spec's `slug` field is named `urlSlug` here, because Astro's glob loader reserves `slug`.
- Pagination: 5 posts per page. Page 1 is `/`, then `/page2/` … `/page7/`.
- These paths must keep working: `/feed.xml`, `/sitemap.xml`, `/about/`, `/certifications/`, `/year-archive/`, `/tags/`, `/assets/docs/cv-andrej-trusevic.pdf` (the nav link has the `download` attribute), and everything under `/assets/**`.
- Visual style: terminal / dev-tool. Dark is the default, with a light toggle. Chrome uses monospace; body text uses a sans font. Sticky TOC on the right; under 1024px it becomes a `<details>` at the top.
- Comments: Giscus. Analytics: GoatCounter at `https://sysadminas.goatcounter.com/count`. Search: Pagefind.
- No Liquid processing. `{{ … }}` in posts renders literally.
- Commit messages use conventional commits, with **no Co-Authored-By trailer** (user rule). There is no CHANGELOG.md in this repo.

## Review Focus

1. **Raw HTML `<img src="../assets/…">` and markdown links to `../assets/…`, inside paragraphs, lists or HTML blocks.** Every one must resolve to `/assets/…`. Pinned by Task 3 unit tests and the Task 5 dist test (no `../assets/` anywhere in `dist/**/*.html`).
2. **Code blocks containing `${{ parameters.x }}`, `{{request.object}}`, `<`, `&`.** These must render literally. Pinned by the Task 5 dist test on `GitOps-with-Flux-and-Helm` and `Host-Trivy-DB-in-ACR`.
3. **Visitors with localStorage blocked or JS disabled.** They must still get a readable, dark-themed page without errors. Pinned by Task 2: the theme script wraps storage in try/catch, `:root` (with no `data-theme`) carries the dark tokens, and a dist test checks both.
4. **Old in-page links like `/tags/#kubernetes` and `/tags/#ci-cd`.** The `/tags/` page must keep element ids that match Jekyll's `slugify`. Pinned by the Task 7 unit test for `tagSlug` and a dist test for ids.
5. **Drafts.** They must never appear in the production build, feed, sitemap or search. Pinned by the Task 4 and Task 8 dist tests.

---

## File Structure

```
astro.config.mjs                 Astro config: site, trailing slash, markdown plugins, Shiki, integrations
package.json / package-lock.json scripts + deps (replaces the old MM boilerplate package.json)
tsconfig.json                    extends astro/tsconfigs/strict
vitest.config.ts                 unit + dist test projects
src/config.ts                    SITE constants + NAV
src/content.config.ts            posts collection + zod schema
src/content/posts/*.md           migrated posts (output of Task 4)
src/lib/posts.ts                 getPublishedPosts, postUrl, formatDate, readingMinutes
src/lib/tags.ts                  tagSlug, collectTags
src/plugins/remark-legacy.ts     kramdown/Jekyll compatibility
src/styles/tokens.css            colour, type and spacing tokens (dark default + light)
src/styles/global.css            base element styles, prose, code, notice, img[align]
src/layouts/Base.astro           html shell, SEO, theme, nav, search, analytics
src/layouts/Post.astro           article + Toc + Giscus + code copy
src/components/Nav.astro, ThemeToggle.astro, Search.astro, Prompt.astro, PostList.astro,
               Pagination.astro, Toc.astro, Giscus.astro, CertGrid.astro, TagList.astro
src/data/certs.ts                18 Credly badge ids
src/pages/index.astro, page[num].astro, [slug].astro, year-archive.astro, about.astro,
          certifications.astro, 404.astro, tags/index.astro, tags/[tag].astro,
          feed.xml.ts, sitemap.xml.ts, robots.txt.ts
public/                          assets/**, favicons, site.webmanifest, browserconfig.xml, CNAME
scripts/lib/migrate.mjs          pure migration helpers
scripts/migrate-posts.mjs        one-off migration runner
scripts/legacy-urls.txt          fixture: every live URL path
scripts/check-urls.mjs           asserts every fixture path exists in dist/
tests/unit/*.test.ts             plugin, migration, tag tests
tests/dist/*.test.ts             assertions over built dist/
.github/workflows/deploy.yml     CI build + deploy
```

---

### Task 1: Scaffold Astro next to Jekyll

**Files:**
- Modify: `package.json` (replace MM boilerplate), `.gitignore`
- Create: `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `src/config.ts`, `src/pages/index.astro` (temporary), `tests/dist/smoke.test.ts`

**Interfaces:**
- Produces: `npm run build` → `dist/`, `npm test` (unit tests), `npm run test:dist` (dist tests, run after build), `SITE`/`NAV` from `src/config.ts`.

- [ ] **Step 1: Replace `package.json`**

```json
{
  "name": "sysadminas-eu",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build && pagefind --site dist",
    "preview": "astro preview",
    "test": "vitest run --project unit",
    "test:dist": "vitest run --project dist",
    "check:urls": "node scripts/check-urls.mjs",
    "migrate": "node scripts/migrate-posts.mjs"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install astro@^7 @astrojs/rss @astrojs/sitemap
npm install -D pagefind vitest gray-matter js-yaml unified remark-parse remark-rehype rehype-stringify unist-util-visit @types/mdast
```

If `pagefind --site dist` fails in Step 6 because `dist` has no pages yet, ignore that until Task 5. The smoke test only needs `astro build`.

- [ ] **Step 3: Fix `.gitignore`.** Remove the line `package-lock.json`, because CI uses `npm ci` and needs the lockfile. Then append:

```
# Astro
dist/
.astro/
```

- [ ] **Step 4: Write configs**

`astro.config.mjs`:
```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://sysadminas.eu',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
});
```

`tsconfig.json`:
```json
{ "extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "**/*"], "exclude": ["dist", "_site", "node_modules"] }
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      { test: { name: 'dist', include: ['tests/dist/**/*.test.ts'] } },
    ],
  },
});
```

`src/config.ts`:
```ts
export const SITE = {
  title: 'sysadminas.eu',
  url: 'https://sysadminas.eu',
  author: 'Andrej Trusevic',
  role: 'Cloud Engineer',
  badge: 'CNCF Golden Kubestronaut',
  topics: ['golden-kubestronaut', 'azure', 'agentic-ai'],
  description: 'Practical Kubernetes, Azure and AI-assisted platform engineering.',
  twitter: '@andriktr',
  postsPerPage: 5,
  cvPath: '/assets/docs/cv-andrej-trusevic.pdf',
  goatcounter: 'https://sysadminas.goatcounter.com/count',
  giscus: {
    repo: 'andriktr/andriktr.github.io',
    repoId: '',        // filled in Task 11 from giscus.app
    category: 'Announcements',
    categoryId: '',    // filled in Task 11 from giscus.app
  },
} as const;

export const NAV = [
  { label: 'posts', href: '/' },
  { label: 'about', href: '/about/' },
  { label: 'cv', href: SITE.cvPath, download: true },
  { label: 'certs', href: '/certifications/' },
] as const;
```

Temporary `src/pages/index.astro`:
```astro
---
import { SITE } from '../config';
---
<html lang="en"><head><meta charset="utf-8" /><title>{SITE.title}</title></head><body><h1>{SITE.author}</h1></body></html>
```

- [ ] **Step 5: Write the failing smoke test** in `tests/dist/smoke.test.ts`

```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('build output', () => {
  it('emits index.html with the author name', () => {
    expect(existsSync('dist/index.html')).toBe(true);
    expect(readFileSync('dist/index.html', 'utf8')).toContain('Andrej Trusevic');
  });
});
```

Run: `rm -rf dist && npm run test:dist`. Expected: FAIL (`dist/index.html` missing).

- [ ] **Step 6: Build and re-run**

Run: `npx astro build && npm run test:dist`. Expected: PASS. The Jekyll folders (`_posts`, `_layouts`, …) are ignored by Astro, so the build must not error on them.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore astro.config.mjs tsconfig.json vitest.config.ts src tests
git commit -m "chore(astro): scaffold Astro project alongside Jekyll"
```

---

### Task 2: Design tokens, Base layout, nav and theme toggle

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/global.css`, `src/layouts/Base.astro`, `src/components/Nav.astro`, `src/components/ThemeToggle.astro`, `tests/dist/base.test.ts`
- Modify: `src/pages/index.astro` (use Base)

**Interfaces:**
- Consumes: `SITE`, `NAV` from `src/config.ts`.
- Produces: `<Base title description? path ogType?>` with a default slot and a named slot `head`. CSS custom properties `--bg --bg-soft --fg --fg-strong --muted --accent --accent-2 --tag --link --border --code-bg --notice --font-mono --font-sans`. The theme lives on `html[data-theme]`, and a `theme-change` CustomEvent is dispatched on `document` with `detail: 'light' | 'dark'`.

- [ ] **Step 1: Write the failing dist test** in `tests/dist/base.test.ts`

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const html = () => readFileSync('dist/index.html', 'utf8');
const css = () => readdirSync('dist/_astro').filter(f => f.endsWith('.css'))
  .map(f => readFileSync(`dist/_astro/${f}`, 'utf8')).join('\n');

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
  it('has canonical url', () => {
    expect(html()).toContain('<link rel="canonical" href="https://sysadminas.eu/"');
  });
});
```

Run: `npx astro build && npm run test:dist`. Expected: FAIL.

- [ ] **Step 2: Write `src/styles/tokens.css`**

```css
:root {
  --bg: #0b0f0c; --bg-soft: #111712; --fg: #c9d1c9; --fg-strong: #e6edf3; --muted: #6b7d6f;
  --accent: #7ee787; --accent-2: #79c0ff; --tag: #d2a8ff; --link: #79c0ff; --border: #1d2a21;
  --code-bg: #0d1117; --notice: #0f1a24;
  --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --measure: 72ch; color-scheme: dark;
}
:root[data-theme='light'] {
  --bg: #fbfaf6; --bg-soft: #f2f0e8; --fg: #24292f; --fg-strong: #0b0f0c; --muted: #6e7781;
  --accent: #1a7f37; --accent-2: #0969da; --tag: #8250df; --link: #0969da; --border: #e5e2d8;
  --code-bg: #f6f8fa; --notice: #eef5ff; color-scheme: light;
}
```

- [ ] **Step 3: Write `src/styles/global.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
@import './tokens.css';
*, *::before, *::after { box-sizing: border-box; }
html { background: var(--bg); color: var(--fg); font-family: var(--font-sans); line-height: 1.65; }
body { margin: 0; min-height: 100vh; }
a { color: var(--link); text-decoration: none; } a:hover { text-decoration: underline; }
.mono { font-family: var(--font-mono); }
.muted { color: var(--muted); }
.wrap { max-width: 1180px; margin: 0 auto; padding: 0 16px; }
.site-header { border-bottom: 1px solid var(--border); font-family: var(--font-mono); font-size: .9rem; }
.site-header .wrap { display: flex; gap: 1rem; align-items: center; justify-content: space-between; padding-block: .9rem; flex-wrap: wrap; }
.site-header .brand { color: var(--accent); }
.site-header nav a { color: var(--muted); margin-left: .75rem; }
.site-header nav a:hover, .site-header nav a[aria-current='page'] { color: var(--fg-strong); }
.kbd { border: 1px solid var(--border); padding: 0 .35rem; border-radius: 3px; color: var(--muted); background: none; font: inherit; cursor: pointer; }
.prompt { font-family: var(--font-mono); color: var(--muted); }
.prompt .user { color: var(--accent); } .prompt .path { color: var(--accent-2); }
h1, h2, h3, h4 { color: var(--fg-strong); line-height: 1.25; }
.prose h2::before { content: '## '; color: var(--accent); font-family: var(--font-mono); }
.prose h3::before { content: '### '; color: var(--accent); font-family: var(--font-mono); }
.prose img { max-width: 100%; height: auto; }
.prose img[align='right'] { float: right; max-width: 45%; margin: 0 0 1rem 1.25rem; }
.prose img[align='left'] { float: left; max-width: 45%; margin: 0 1.25rem 1rem 0; }
@media (max-width: 640px) { .prose img[align] { float: none; display: block; max-width: 100%; margin: 1rem auto; } }
.prose :not(pre) > code { font-family: var(--font-mono); background: var(--code-bg); padding: .1em .35em; border-radius: 3px; font-size: .9em; }
.prose blockquote { border-left: 2px solid var(--border); margin: 1rem 0; padding: .25rem 1rem; color: var(--muted); }
.prose table { border-collapse: collapse; display: block; overflow-x: auto; }
.prose th, .prose td { border: 1px solid var(--border); padding: .35rem .6rem; }
.astro-code { position: relative; font-family: var(--font-mono); font-size: .85rem; border: 1px solid var(--border); border-radius: 4px; padding: 2rem 1rem 1rem; overflow-x: auto; }
.astro-code, .astro-code span { color: var(--shiki-dark); background-color: var(--shiki-dark-bg); }
:root[data-theme='light'] .astro-code, :root[data-theme='light'] .astro-code span { color: var(--shiki-light); background-color: var(--shiki-light-bg); }
.code-lang { position: absolute; top: .4rem; left: .75rem; font-size: .7rem; color: var(--muted); }
.code-copy { position: absolute; top: .3rem; right: .5rem; font: .7rem var(--font-mono); color: var(--muted); background: none; border: 1px solid var(--border); border-radius: 3px; cursor: pointer; }
.notice { border-left: 2px solid var(--accent-2); background: var(--notice); padding: .6rem .9rem; margin: 1.25rem 0; }
.notice::before { content: '[NOTE] '; font-family: var(--font-mono); color: var(--accent-2); }
.tag { color: var(--tag); font-family: var(--font-mono); }
footer.site-footer { border-top: 1px solid var(--border); margin-top: 4rem; padding: 1.5rem 0; font: .8rem var(--font-mono); color: var(--muted); }
```

- [ ] **Step 4: Write the components**

`src/components/ThemeToggle.astro`:
```astro
<button class="kbd" type="button" id="theme-toggle" aria-label="Toggle colour theme">☀/☾</button>
<script>
  const btn = document.getElementById('theme-toggle');
  btn?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch {}
    document.dispatchEvent(new CustomEvent('theme-change', { detail: next }));
  });
</script>
```

`src/components/Nav.astro`:
```astro
---
import { NAV } from '../config';
import ThemeToggle from './ThemeToggle.astro';
interface Props { path: string }
const { path } = Astro.props;
const crumb = path === '/' ? '' : path.replace(/\/$/, '').split('/').slice(0, 2).join('/');
---
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/">~/sysadminas{crumb}</a>
    <nav aria-label="Main">
      {NAV.map((l) => (
        <a href={l.href} download={'download' in l ? true : undefined}
           aria-current={l.href === path ? 'page' : undefined}>[{l.label}]</a>
      ))}
      <button class="kbd" type="button" data-search-open aria-label="Search">/</button>
      <ThemeToggle />
    </nav>
  </div>
</header>
```

`src/layouts/Base.astro`:
```astro
---
import '../styles/global.css';
import Nav from '../components/Nav.astro';
import { SITE } from '../config';
interface Props { title?: string; description?: string; ogType?: 'website' | 'article' }
const { title, description = SITE.description, ogType = 'website' } = Astro.props;
const path = Astro.url.pathname;
const fullTitle = title ? `${title} | ${SITE.title}` : `${SITE.author} | ${SITE.title}`;
const canonical = new URL(path, SITE.url).href;
---
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{fullTitle}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <meta property="og:type" content={ogType} />
  <meta property="og:title" content={title ?? SITE.title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:site" content={SITE.twitter} />
  <link rel="alternate" type="application/rss+xml" title={SITE.title} href="/feed.xml" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <link rel="manifest" href="/site.webmanifest" />
  <script is:inline>(function(){var t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t})();</script>
  <slot name="head" />
</head>
<body>
  <Nav path={path} />
  <main class="wrap"><slot /></main>
  <footer class="site-footer"><div class="wrap">© {new Date().getUTCFullYear()} {SITE.author} · <a href="/feed.xml">rss</a> · <a href="https://github.com/andriktr">github</a> · <a href="https://www.linkedin.com/in/andrej-trusevic-53879a7a/">linkedin</a></div></footer>
</body>
</html>
```

The Base layout gets search and analytics added in Tasks 8 and 9.

Replace `src/pages/index.astro` with:
```astro
---
import Base from '../layouts/Base.astro';
import { SITE } from '../config';
---
<Base><h1>{SITE.author}</h1></Base>
```

- [ ] **Step 5: Build and run tests**

Run: `npx astro build && npm run test:dist`. Expected: PASS for all of `smoke` and `base`. If the CSS regex fails only on whitespace or minification differences, check the built CSS and adjust the regex, not the tokens.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat(theme): add terminal design tokens, base layout, nav and theme toggle"
```

---

### Task 3: `remark-legacy` plugin (Jekyll/kramdown compatibility)

**Files:**
- Create: `src/plugins/remark-legacy.ts`, `tests/unit/remark-legacy.test.ts`
- Modify: `astro.config.mjs` (register plugin)

**Interfaces:**
- Produces: `export default function remarkLegacy(): (tree: Root) => void`. Effects:
  - a paragraph ending in kramdown IAL lines (`{: .notice--info}`, `{: .text-justify}`) loses those lines. If one of the classes is `notice` or `notice--*`, it renders as `<aside class="notice notice--info">`.
  - a standalone IAL paragraph applies to the previous sibling and is removed.
  - the inline html `<i class="far fa-sticky-note"></i>` is removed.
  - in `image`/`link` nodes, the url prefix `../assets/` becomes `/assets/`.
  - in `html` nodes, `src="../assets/` and `href="../assets/` become root paths.

- [ ] **Step 1: Write the failing tests** in `tests/unit/remark-legacy.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkLegacy from '../../src/plugins/remark-legacy';

const render = async (md: string) => String(await unified()
  .use(remarkParse).use(remarkLegacy)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true })
  .process(md));

describe('remark-legacy', () => {
  it('turns a trailing notice IAL into an aside and drops the FA icon', async () => {
    const out = await render('<i class="far fa-sticky-note"></i> **Note:** Back up first.\n{: .notice--info}\n');
    expect(out).toBe('<aside class="notice notice--info"><strong>Note:</strong> Back up first.</aside>');
  });
  it('handles stacked IAL lines (notice + text-justify)', async () => {
    const out = await render('**Note:** Reboot.\n{: .notice--info}\n{: .text-justify}\n');
    expect(out).toContain('<aside class="notice notice--info">');
    expect(out).not.toContain('{:');
  });
  it('strips text-justify only, keeping a normal paragraph', async () => {
    expect(await render('Hello world.\n{: .text-justify}\n')).toBe('<p>Hello world.</p>');
  });
  it('applies a standalone IAL paragraph to the previous block', async () => {
    const out = await render('Careful here.\n\n{: .notice--info}\n');
    expect(out).toBe('<aside class="notice notice--info">Careful here.</aside>');
  });
  it('rewrites relative asset urls in markdown images and links', async () => {
    const out = await render('![a](../assets/images/post8/azure1.png "a") [cv](../assets/docs/x.pdf)');
    expect(out).toContain('src="/assets/images/post8/azure1.png"');
    expect(out).toContain('href="/assets/docs/x.pdf"');
  });
  it('rewrites relative asset urls in raw html img tags', async () => {
    const out = await render('<img align="right" width="300" height="300" src="../assets/images/post1/azure-sql.jpg">\n');
    expect(out).toContain('src="/assets/images/post1/azure-sql.jpg"');
    expect(out).not.toContain('../assets/');
  });
  it('leaves {{ }} in code untouched', async () => {
    const out = await render('```yaml\nname: ${{ parameters.env }}\n```\n');
    expect(out).toContain('${{ parameters.env }}');
  });
});
```

Run: `npm test`. Expected: FAIL (module not found).

- [ ] **Step 2: Implement `src/plugins/remark-legacy.ts`**

```ts
import type { Root, Paragraph, Text, Parent, RootContent } from 'mdast';
import { visit, SKIP } from 'unist-util-visit';

const IAL_TAIL = /(?:\s*\n?\{:\s*([^}]*)\}\s*)+$/;
const IAL_ONLY = /^(?:\s*\{:\s*[^}]*\}\s*)+$/;
const FA_ICON = /^<i class="fa[rsb]? fa-[\w-]+"><\/i>$/;
const FA_OPEN = /^<i class="fa[rsb]? fa-[\w-]+">$/;

function classesFrom(ial: string): string[] {
  return [...ial.matchAll(/\{:\s*([^}]*)\}/g)]
    .flatMap((m) => m[1].split(/\s+/))
    .filter((t) => t.startsWith('.'))
    .map((t) => t.slice(1));
}

function applyClasses(node: RootContent, classes: string[]) {
  const notice = classes.filter((c) => c === 'notice' || c.startsWith('notice--'));
  if (!notice.length || node.type !== 'paragraph') return;
  node.data = { ...node.data, hName: 'aside', hProperties: { className: ['notice', ...notice.filter((c) => c !== 'notice')] } };
}

const fixUrl = (u: string) => (u.startsWith('../assets/') ? u.slice(2) : u);

export default function remarkLegacy() {
  return (tree: Root) => {
    visit(tree, (node, index, parent: Parent | undefined) => {
      if (node.type === 'image' || node.type === 'link') { node.url = fixUrl(node.url); return; }
      if (node.type === 'html') {
        // remark emits inline `<i …></i>` either as one html node or as an open/close pair
        const v = node.value.trim();
        const next0 = parent && index !== undefined ? parent.children[index + 1] : undefined;
        const isPair = FA_OPEN.test(v) && next0?.type === 'html' && next0.value.trim() === '</i>';
        if ((FA_ICON.test(v) || isPair) && parent && index !== undefined) {
          parent.children.splice(index, isPair ? 2 : 1);
          const next = parent.children[index];
          if (next?.type === 'text') next.value = next.value.replace(/^\s+/, '');
          return [SKIP, index];
        }
        node.value = node.value.replace(/(src|href)="\.\.\/assets\//g, '$1="/assets/');
        return;
      }
      if (node.type !== 'paragraph' || !parent || index === undefined) return;
      const para = node as Paragraph;
      const last = para.children[para.children.length - 1];
      if (last?.type !== 'text') return;
      const text = last as Text;
      if (para.children.length === 1 && IAL_ONLY.test(text.value)) {
        const prev = parent.children[index - 1];
        if (prev) applyClasses(prev as RootContent, classesFrom(text.value));
        parent.children.splice(index, 1);
        return [SKIP, index];
      }
      const m = text.value.match(IAL_TAIL);
      if (!m) return;
      const classes = classesFrom(m[0]);
      text.value = text.value.slice(0, m.index).replace(/\s+$/, '');
      if (!text.value) para.children.pop();
      applyClasses(para, classes);
    });
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npm test`. Expected: all 7 PASS. The FA-icon branch handles both shapes remark can produce (a single `<i …></i>` node, or an open/close pair). If the first test still fails, print the mdast with `console.dir(unified().use(remarkParse).parse(md), { depth: null })` and adjust the matcher to the actual shape.

- [ ] **Step 4: Register the plugin** in `astro.config.mjs`

```js
import remarkLegacy from './src/plugins/remark-legacy.ts';
// inside defineConfig({ markdown: { remarkPlugins: [remarkLegacy], shikiConfig: {...} } })
```

Run: `npx astro build`. Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/plugins tests/unit astro.config.mjs
git commit -m "feat(content): add remark plugin for legacy kramdown notices and asset paths"
```

---

### Task 4: Content collection, migration script, and assets

**Files:**
- Create: `src/content.config.ts`, `scripts/lib/migrate.mjs`, `scripts/migrate-posts.mjs`, `tests/unit/migrate.test.ts`, `src/lib/posts.ts`, `tests/dist/drafts.test.ts`
- Move: `assets/` → `public/assets/`, and the root favicons, `site.webmanifest`, `browserconfig.xml`, `CNAME` → `public/`
- Generated: `src/content/posts/*.md` (32 files: 31 posts + 1 draft)

**Interfaces:**
- Produces: collection `posts` with data `{ title: string; excerpt: string; date: Date; tags: string[]; toc: boolean; draft: boolean; urlSlug: string }`. From `src/lib/posts.ts`: `getPublishedPosts(): Promise<Post[]>` (newest first, drafts only in dev), `postUrl(p: Post): string`, `formatDate(d: Date): string` (`YYYY-MM-DD`, UTC), `readingMinutes(body?: string): number`. From `scripts/lib/migrate.mjs`: `parseLegacyDate(s)`, `normaliseTag(t)`, `slugFromFilename(f)`, `transformFrontmatter(data, filename, { draft })`.

- [ ] **Step 1: Write the failing migration tests** in `tests/unit/migrate.test.ts`

```ts
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
  });
  it('transforms frontmatter and dedupes tags', () => {
    const out = transformFrontmatter(
      { title: 'T', excerpt: 'E', date: 'August 02, 2019', toc: true, toc_label: 'Content', toc_sticky: true, tags: ['K8S', 'Kubernetes', 'Azure'] },
      '2019-08-02-Part-1-Azure-SQL-DB-Backups.md', { draft: false });
    expect(out).toEqual({ title: 'T', excerpt: 'E', date: '2019-08-02', urlSlug: 'Part-1-Azure-SQL-DB-Backups', tags: ['Kubernetes', 'Azure'], toc: true, draft: false });
  });
});
```

Run: `npm test`. Expected: FAIL (module not found).

- [ ] **Step 2: Implement `scripts/lib/migrate.mjs`**

```js
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const TAG_ALIASES = {
  K8S: 'Kubernetes', k8s: 'Kubernetes', Github: 'GitHub', AzureDevOps: 'Azure DevOps', ADO: 'Azure DevOps',
  FluxCD: 'Flux', GO: 'Go', Golang: 'Go', AAD: 'Azure AD', AzureAD: 'Azure AD', Container: 'Containers',
  Charts: 'Helm Chart', DB: 'Database', 'Argo CD': 'Argo CD', Argo: 'Argo CD', Aqua: 'Aquasec',
};

export function parseLegacyDate(s) {
  if (s instanceof Date) return s.toISOString().slice(0, 10);
  const m = String(s).trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) throw new Error(`Unrecognised date: ${s}`);
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (!month) throw new Error(`Unrecognised month: ${s}`);
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

export const slugFromFilename = (f) => f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-[\dx]{2}-/, '');

export function normaliseTag(t) {
  const trimmed = String(t).trim();
  return TAG_ALIASES[trimmed] ?? trimmed;
}

export function transformFrontmatter(data, filename, { draft }) {
  const tags = [...new Set((data.tags ?? []).map(normaliseTag))];
  return {
    title: String(data.title).trim(),
    excerpt: String(data.excerpt ?? '').trim(),
    date: parseLegacyDate(data.date),
    urlSlug: slugFromFilename(filename),
    tags,
    toc: data.toc !== false,
    draft,
  };
}
```

Run: `npm test`. Expected: migrate tests PASS.

- [ ] **Step 3: Write the runner `scripts/migrate-posts.mjs`**

```js
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { transformFrontmatter } from './lib/migrate.mjs';

const OUT = 'src/content/posts';
const LINK_FIXES = [['/Part-2-Azure-SQL-DB-backups-Configure-the-backups/', '/Part-2-Azure-SQL-DB-backups/']];
mkdirSync(OUT, { recursive: true });

for (const [dir, draft] of [['_posts', false], ['_drafts', true]]) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'blank.md')) {
    const { data, content } = matter(readFileSync(`${dir}/${file}`, 'utf8'));
    const fm = transformFrontmatter(data, file, { draft });
    let body = content;
    for (const [from, to] of LINK_FIXES) body = body.replaceAll(from, to);
    const out = `---\n${yaml.dump(fm, { lineWidth: -1 })}---\n${body}`;
    writeFileSync(`${OUT}/${fm.urlSlug}.md`, out);
    console.log(`${draft ? 'draft' : 'post '} ${fm.urlSlug}`);
  }
}
```

If the draft's `date` isn't a parseable "Month DD, YYYY" (the filename is `2024-08-xx-…`), the runner throws. In that case set its date to `2024-08-01` in the source draft's front matter first, and say so in the commit message.

- [ ] **Step 4: Write `src/content.config.ts`**

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string().min(1),
    excerpt: z.string().default(''),
    date: z.coerce.date(),
    urlSlug: z.string().regex(/^[A-Za-z0-9-]+$/),
    tags: z.array(z.string()).default([]),
    toc: z.boolean().default(true),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

If the installed Astro version exports `z` only from `astro:content`, switch the import and keep everything else.

- [ ] **Step 5: Write `src/lib/posts.ts`**

```ts
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'posts'>;

export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('posts', ({ data }) => (import.meta.env.PROD ? !data.draft : true));
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}
export const postUrl = (p: Post) => `/${p.data.urlSlug}/`;
export const formatDate = (d: Date) => d.toISOString().slice(0, 10);
export const readingMinutes = (body = '') => Math.max(1, Math.round(body.split(/\s+/).filter(Boolean).length / 200));
```

- [ ] **Step 6: Run the migration and move the static files**

```bash
npm run migrate            # expect 31 "post" lines + 1 "draft" line
ls src/content/posts | wc -l   # expect 32
mkdir -p public
git mv assets public/assets
git mv CNAME site.webmanifest browserconfig.xml favicon.ico favicon-16x16.png favicon-32x32.png apple-touch-icon.png android-chrome-192x192.png android-chrome-256x256.png android-chrome-512x512.png mstile-150x150.png safari-pinned-tab.svg public/
git rm -r --cached public/assets/images/post25_skip 2>/dev/null; rm -rf public/assets/images/post25_skip
find public -name .DS_Store -delete
```

Remove the theme-only folders that would otherwise be published as static files: `git rm -r public/assets/js public/assets/css`. Then fix `public/site.webmanifest`: set `"name": "sysadminas.eu"`, `"short_name": "sysadminas"`, `"theme_color": "#0b0f0c"`, `"background_color": "#0b0f0c"`, and add the 512px icon entry `{ "src": "/android-chrome-512x512.png", "sizes": "512x512", "type": "image/png" }`.

- [ ] **Step 7: Write the failing drafts dist test** in `tests/dist/drafts.test.ts`

```ts
import { existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

describe('drafts', () => {
  it('are not built in production', () => {
    expect(existsSync('dist/Part-11-AKS/index.html')).toBe(false);
  });
});
```

This test passes trivially until Task 5 adds post routes. Task 5's tests prove that posts *do* render, which makes this test meaningful.

- [ ] **Step 8: Build, test and commit**

Run: `npx astro build && npm test && npm run test:dist`. Expected: build OK (the schema validates all 32 files) and all tests PASS. A schema error names the file. Fix the source front matter, not the schema.

```bash
git add -A src scripts tests public .gitignore
git commit -m "feat(content): migrate 31 posts into Astro content collection and move static assets to public/"
```

---

### Task 5: Post page (route, layout, TOC, code blocks)

**Files:**
- Create: `src/pages/[slug].astro`, `src/layouts/Post.astro`, `src/components/Toc.astro`, `src/components/TagList.astro`, `src/lib/tags.ts`, `tests/dist/posts.test.ts`
- Modify: `src/styles/global.css` (post grid + TOC styles)

**Interfaces:**
- Consumes: `getPublishedPosts`, `postUrl`, `formatDate`, `readingMinutes` (Task 4), `Base` (Task 2).
- Produces: `/<urlSlug>/index.html` for every published post. From `src/lib/tags.ts`: `tagSlug(tag: string): string`. `<TagList tags={string[]} />` links each tag to `/tags/<tagSlug>/`. `Post.astro` props: `{ post: Post; headings: MarkdownHeading[] }`, with a named slot `after` for comments. Post bodies carry `data-pagefind-body`.

- [ ] **Step 1: Write the failing dist test** in `tests/dist/posts.test.ts`

```ts
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
```

Create the fixture `scripts/legacy-urls.txt` now. Task 10 uses it too. It holds one path per line, taken from the live sitemap fetched on 2026-10-08:

```
/
/Part-1-Azure-SQL-DB-Backups/
/Part-2-Azure-SQL-DB-backups/
/Part-3-Azure-SQL-DB-Backups/
/DPM-Impovements/
/Part-1-AKS/
/Part-2-AKS/
/Part-3-AKS/
/Part-4-AKS/
/CKA/
/CKAD/
/Az-Storage-Soft-Delete/
/Part-5-AKS/
/Part-6-AKS/
/Az-KeyVault-Soft-Delete/
/Part-7-AKS/
/ACR-Manage-and-Secure/
/Part-8-AKS/
/Azure-Storage-Soft-Delete-v2/
/Part-9-AKS/
/Your-First-GO-app-on-k8s/
/Part-10-AKS/
/Tools-For-Successful-AKS-Journey/
/Consul-OIDC-Auth-with-AzureAD/
/Your-First-Python-app-on-k8s/
/Helm-Release-Viewer/
/Kubestronaut/
/Host-Trivy-DB-in-ACR/
/Golden-Kubestronaut/
/GitOps-with-Flux-and-Helm/
/AI-Agents-and-Helm-Chart-Upgrades/
/AKS-Issue-Analyzer-Claude-Skill/
/about/
/certifications/
/tags/
/year-archive/
/page2/
/page3/
/page4/
/page5/
/page6/
/page7/
/feed.xml
/sitemap.xml
/assets/docs/cv-andrej-trusevic.pdf
/assets/docs/cv-andrej-trusevic_old.pdf
/assets/docs/post17/CKS.html
```

The slug filter regex in the test accepts paths that start with an uppercase letter, which covers all 31 posts. Assert that `SLUGS.length` is 31. If the count is off, fix the filter, not the fixture.

Run: `npx astro build && npm run test:dist`. Expected: FAIL (no post pages).

- [ ] **Step 2: Write `src/lib/tags.ts`** (shared with Task 7)

```ts
export const tagSlug = (tag: string) =>
  tag.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
```

- [ ] **Step 3: Write `src/components/TagList.astro` and `src/components/Toc.astro`**

```astro
---
// TagList.astro
import { tagSlug } from '../lib/tags';
interface Props { tags: string[] }
const { tags } = Astro.props;
---
{tags.map((t) => <a class="tag" href={`/tags/${tagSlug(t)}/`}>#{tagSlug(t)}</a>)}
```

```astro
---
// Toc.astro
import type { MarkdownHeading } from 'astro';
interface Props { headings: MarkdownHeading[] }
const items = Astro.props.headings.filter((h) => h.depth === 2 || h.depth === 3);
---
{items.length >= 3 && (
  <nav class="toc" aria-label="Contents">
    <details open>
      <summary class="mono">## contents</summary>
      <ul>{items.map((h) => <li class={`d${h.depth}`}><a href={`#${h.slug}`}>{h.text}</a></li>)}</ul>
    </details>
  </nav>
)}
<script>
  const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc a')];
  const byId = new Map(links.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      links.forEach((a) => a.classList.remove('active'));
      byId.get(e.target.id)?.classList.add('active');
    }
  }, { rootMargin: '0px 0px -70% 0px' });
  byId.forEach((_, id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
  if (matchMedia('(max-width: 1023px)').matches) document.querySelector('.toc details')?.removeAttribute('open');
</script>
```

- [ ] **Step 4: Write `src/layouts/Post.astro`**

```astro
---
import type { MarkdownHeading } from 'astro';
import Base from './Base.astro';
import Toc from '../components/Toc.astro';
import TagList from '../components/TagList.astro';
import { formatDate, readingMinutes, type Post } from '../lib/posts';
interface Props { post: Post; headings: MarkdownHeading[] }
const { post, headings } = Astro.props;
const { title, excerpt, date, tags, toc } = post.data;
---
<Base title={title} description={excerpt} ogType="article">
  <div class="post-grid">
    <article>
      <p class="prompt">$ cat {post.data.urlSlug.toLowerCase()}.md</p>
      <h1>{title}</h1>
      <p class="meta mono muted">{formatDate(date)} · {readingMinutes(post.body)} min · <TagList tags={tags} /></p>
      <div class="prose" data-pagefind-body><slot /></div>
      <slot name="after" />
    </article>
    {toc && <aside class="toc-col"><Toc headings={headings} /></aside>}
  </div>
</Base>
<script>
  document.querySelectorAll<HTMLPreElement>('pre.astro-code').forEach((pre) => {
    const lang = pre.dataset.language;
    if (lang && lang !== 'plaintext') pre.insertAdjacentHTML('afterbegin', `<span class="code-lang">${lang}</span>`);
    const btn = document.createElement('button');
    btn.className = 'code-copy'; btn.type = 'button'; btn.textContent = 'copy';
    btn.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(pre.querySelector('code')?.innerText ?? ''); btn.textContent = 'copied'; }
      catch { btn.textContent = 'failed'; }
      setTimeout(() => (btn.textContent = 'copy'), 1500);
    });
    pre.appendChild(btn);
  });
</script>
```

- [ ] **Step 5: Write `src/pages/[slug].astro`**

```astro
---
import { render } from 'astro:content';
import Post from '../layouts/Post.astro';
import { getPublishedPosts } from '../lib/posts';

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  return posts.map((post) => ({ params: { slug: post.data.urlSlug }, props: { post } }));
}
const { post } = Astro.props;
const { Content, headings } = await render(post);
---
<Post post={post} headings={headings}><Content /></Post>
```

- [ ] **Step 6: Add post-page CSS** to `src/styles/global.css`

```css
.post-grid { display: grid; grid-template-columns: minmax(0, 1fr) 240px; gap: 2.5rem; padding-top: 1.5rem; }
.post-grid article { min-width: 0; max-width: var(--measure); }
.post-grid h1 { font-size: clamp(1.6rem, 3vw, 2.2rem); margin: .4rem 0; }
.meta { font-size: .8rem; display: flex; flex-wrap: wrap; gap: .5rem; }
.toc-col { position: relative; }
.toc { position: sticky; top: 1.5rem; font: .8rem var(--font-mono); border-left: 1px solid var(--border); padding-left: .9rem; }
.toc summary { color: var(--fg); cursor: pointer; list-style: none; }
.toc ul { list-style: none; padding: 0; margin: .5rem 0 0; }
.toc li { margin: .3rem 0; } .toc li.d3 { padding-left: .9rem; }
.toc a { color: var(--muted); } .toc a.active { color: var(--accent); } .toc a.active::before { content: '› '; }
@media (max-width: 1023px) {
  .post-grid { grid-template-columns: 1fr; }
  .toc-col { order: -1; }
  .toc { position: static; border: 1px solid var(--border); padding: .6rem .9rem; }
}
```

- [ ] **Step 7: Build and test**

Run: `npx astro build && npm run test:dist`. Expected: `posts`, `drafts`, `base` and `smoke` all PASS. If `data-language` isn't on `<pre>`, check the built HTML for the attribute Shiki uses in this Astro version, then update both the test and the copy script to use it.

- [ ] **Step 8: Check visually.** Run `npx astro preview` and open `/AKS-Issue-Analyzer-Claude-Skill/`, `/Part-1-Azure-SQL-DB-Backups/` (right-aligned image) and `/GitOps-with-Flux-and-Helm/` in both themes, at 1280px and 375px wide. The TOC should be sticky on desktop and a collapsed `<details>` above the article on mobile.

- [ ] **Step 9: Commit**

```bash
git add src tests scripts/legacy-urls.txt
git commit -m "feat(posts): add post layout with sticky TOC, code labels and copy buttons"
```

---

### Task 6: Home page and `/pageN/` pagination

**Files:**
- Create: `src/components/Prompt.astro`, `src/components/PostList.astro`, `src/components/Pagination.astro`, `src/pages/page[num].astro`, `tests/dist/home.test.ts`
- Modify: `src/pages/index.astro`, `src/styles/global.css`

**Interfaces:**
- Consumes: `getPublishedPosts`, `postUrl`, `formatDate` (Task 4), `TagList` (Task 5), `SITE.postsPerPage`.
- Produces: `<PostList posts={Post[]} />`, `<Pagination current={number} total={number} />` (page 1 → `/`, n → `/page{n}/`), and `<Prompt cmd={string} />`.

- [ ] **Step 1: Write the failing test** in `tests/dist/home.test.ts`

```ts
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
```

Run: `npx astro build && npm run test:dist`. Expected: FAIL.

- [ ] **Step 2: Write the components**

```astro
---
// Prompt.astro
interface Props { cmd: string }
---
<p class="prompt"><span class="user">andrej@aks</span>:<span class="path">~</span>$ {Astro.props.cmd}</p>
```

```astro
---
// PostList.astro
import TagList from './TagList.astro';
import { formatDate, postUrl, type Post } from '../lib/posts';
interface Props { posts: Post[] }
---
<ul class="post-list">
  {Astro.props.posts.map((p) => (
    <li class="post-row">
      <span class="mono muted">{formatDate(p.data.date)}</span>
      <a class="post-title" href={postUrl(p)}>{p.data.title}</a>
      <span class="post-tags"><TagList tags={p.data.tags.slice(0, 3)} /></span>
      {p.data.excerpt && <p class="post-excerpt muted">{p.data.excerpt}</p>}
    </li>
  ))}
</ul>
```

```astro
---
// Pagination.astro
interface Props { current: number; total: number }
const { current, total } = Astro.props;
const href = (n: number) => (n === 1 ? '/' : `/page${n}/`);
---
{total > 1 && (
  <nav class="pager mono" aria-label="Pagination">
    {current > 1 ? <a href={href(current - 1)}>← newer</a> : <span />}
    <span class="muted">page {current}/{total}</span>
    {current < total ? <a href={href(current + 1)}>older →</a> : <span />}
  </nav>
)}
```

- [ ] **Step 3: Write the pages**

`src/pages/index.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Prompt from '../components/Prompt.astro';
import PostList from '../components/PostList.astro';
import Pagination from '../components/Pagination.astro';
import { SITE } from '../config';
import { getPublishedPosts } from '../lib/posts';
const posts = await getPublishedPosts();
const total = Math.ceil(posts.length / SITE.postsPerPage);
---
<Base>
  <section class="hero">
    <Prompt cmd="whoami" />
    <h1>{SITE.author} — {SITE.role}</h1>
    <p class="mono muted"># {SITE.topics.join(' · ')}</p>
  </section>
  <Prompt cmd="ls -t posts/ | head -5" />
  <PostList posts={posts.slice(0, SITE.postsPerPage)} />
  <Pagination current={1} total={total} />
</Base>
```

`src/pages/page[num].astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Prompt from '../components/Prompt.astro';
import PostList from '../components/PostList.astro';
import Pagination from '../components/Pagination.astro';
import { SITE } from '../config';
import { getPublishedPosts, type Post } from '../lib/posts';

export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  const total = Math.ceil(posts.length / SITE.postsPerPage);
  return Array.from({ length: Math.max(0, total - 1) }, (_, i) => {
    const n = i + 2;
    return { params: { num: String(n) }, props: { n, total, posts: posts.slice((n - 1) * SITE.postsPerPage, n * SITE.postsPerPage) } };
  });
}
const { n, total, posts } = Astro.props as { n: number; total: number; posts: Post[] };
---
<Base title={`Posts — page ${n}`}>
  <Prompt cmd={`ls -t posts/ | sed -n '${(n - 1) * SITE.postsPerPage + 1},${n * SITE.postsPerPage}p'`} />
  <PostList posts={posts} />
  <Pagination current={n} total={total} />
</Base>
```

- [ ] **Step 4: Add CSS**

```css
.hero { padding: 2.5rem 0 1.5rem; } .hero h1 { font: 700 1.4rem var(--font-mono); margin: .3rem 0; }
.post-list { list-style: none; padding: 0; margin: .5rem 0 2rem; font-family: var(--font-mono); }
.post-row { display: grid; grid-template-columns: 7.5rem 1fr; gap: .25rem 1rem; padding: .7rem 0; border-bottom: 1px dashed var(--border); }
.post-title { color: var(--fg-strong); font-family: var(--font-sans); font-weight: 600; }
.post-tags { grid-column: 2; font-size: .75rem; display: flex; gap: .5rem; flex-wrap: wrap; }
.post-excerpt { grid-column: 2; margin: 0; font: .9rem var(--font-sans); }
@media (max-width: 640px) { .post-row { grid-template-columns: 1fr; } .post-tags, .post-excerpt { grid-column: 1; } }
.pager { display: flex; justify-content: space-between; font-size: .85rem; padding: 1rem 0; }
```

- [ ] **Step 5: Build, test and commit**

Run: `npx astro build && npm run test:dist`. Expected: PASS. If Astro errors because `page[num]` and `[slug]` match ambiguously, move pagination generation into `[slug].astro`'s `getStaticPaths`. Emit extra entries `{ params: { slug: 'page' + n }, props: { kind: 'page', … } }` there, and branch on `kind` in the template. Keep the same tests.

```bash
git add src tests
git commit -m "feat(home): add terminal-style home page and /pageN/ pagination"
```

---

### Task 7: Tags, year archive, about, certifications, 404

**Files:**
- Create: `src/pages/tags/index.astro`, `src/pages/tags/[tag].astro`, `src/pages/year-archive.astro`, `src/pages/about.astro`, `src/pages/certifications.astro`, `src/pages/404.astro`, `src/components/CertGrid.astro`, `src/data/certs.ts`, `tests/unit/tags.test.ts`, `tests/dist/pages.test.ts`
- Modify: `src/lib/tags.ts` (add `collectTags`)

**Interfaces:**
- Consumes: `tagSlug` (Task 5), `getPublishedPosts`, `PostList`, `Prompt`.
- Produces: `collectTags(posts: Post[]): { name: string; slug: string; posts: Post[] }[]`, sorted by post count descending and then by name. `CERT_BADGE_IDS: string[]`.

- [ ] **Step 1: Write the failing unit test** in `tests/unit/tags.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { tagSlug } from '../../src/lib/tags';

describe('tagSlug matches Jekyll slugify for legacy anchors', () => {
  it.each([
    ['Kubernetes', 'kubernetes'], ['Claude Code', 'claude-code'], ['CI/CD', 'ci-cd'],
    ['Azure DevOps', 'azure-devops'], ['Trivy-Operator', 'trivy-operator'], ['OCI Registry', 'oci-registry'],
  ])('%s → %s', (input, expected) => expect(tagSlug(input)).toBe(expected));
});
```

Run: `npm test`. Expected: PASS for `tagSlug`. This pins existing behaviour. Then add `collectTags` to `src/lib/tags.ts`:

```ts
import type { Post } from './posts';
export function collectTags(posts: Post[]) {
  const map = new Map<string, { name: string; slug: string; posts: Post[] }>();
  for (const p of posts) for (const name of p.data.tags) {
    const slug = tagSlug(name);
    const entry = map.get(slug) ?? { name, slug, posts: [] };
    entry.posts.push(p); map.set(slug, entry);
  }
  return [...map.values()].sort((a, b) => b.posts.length - a.posts.length || a.name.localeCompare(b.name));
}
```

`tags.ts` now imports a type from `posts.ts`, which imports `astro:content`. Use `import type` only so the unit test keeps running outside Astro.

- [ ] **Step 2: Generate `src/data/certs.ts`**

```bash
{ echo '// Credly badge ids, in display order (from the old _pages/certifications.html)'; echo 'export const CERT_BADGE_IDS = ['; grep -o 'data-share-badge-id="[^"]*"' _pages/certifications.html | sed 's/.*="\(.*\)"/  "\1",/'; echo '];'; } > src/data/certs.ts
grep -c '",' src/data/certs.ts   # expect 18
```

- [ ] **Step 3: Write the failing dist test** in `tests/dist/pages.test.ts`

```ts
import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const read = (p: string) => readFileSync(`dist${p}`, 'utf8');

describe('secondary pages', () => {
  it('tags index keeps legacy anchors', () => {
    const html = read('/tags/index.html');
    for (const id of ['kubernetes', 'aks', 'claude-code', 'ci-cd']) expect(html).toContain(`id="${id}"`);
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
```

Run: `npx astro build && npm run test:dist`. Expected: FAIL.

- [ ] **Step 4: Write the pages**

`src/pages/tags/index.astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import Prompt from '../../components/Prompt.astro';
import PostList from '../../components/PostList.astro';
import { getPublishedPosts } from '../../lib/posts';
import { collectTags } from '../../lib/tags';
const tags = collectTags(await getPublishedPosts());
---
<Base title="Tags">
  <Prompt cmd="ls tags/" />
  <p class="tag-cloud mono">{tags.map((t) => <a class="tag" href={`#${t.slug}`}>#{t.slug}<sup class="muted">{t.posts.length}</sup></a>)}</p>
  {tags.map((t) => (
    <section>
      <h2 id={t.slug} class="mono"><a href={`/tags/${t.slug}/`}>#{t.slug}</a></h2>
      <PostList posts={t.posts} />
    </section>
  ))}
</Base>
```

`src/pages/tags/[tag].astro`:
```astro
---
import Base from '../../layouts/Base.astro';
import Prompt from '../../components/Prompt.astro';
import PostList from '../../components/PostList.astro';
import { getPublishedPosts } from '../../lib/posts';
import { collectTags } from '../../lib/tags';
export async function getStaticPaths() {
  return collectTags(await getPublishedPosts()).map((t) => ({ params: { tag: t.slug }, props: { t } }));
}
const { t } = Astro.props;
---
<Base title={`#${t.slug}`}>
  <Prompt cmd={`grep -l "#${t.slug}" posts/*`} />
  <PostList posts={t.posts} />
  <p class="mono"><a href="/tags/">← all tags</a></p>
</Base>
```

`src/pages/year-archive.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Prompt from '../components/Prompt.astro';
import PostList from '../components/PostList.astro';
import { getPublishedPosts } from '../lib/posts';
const posts = await getPublishedPosts();
const years = [...new Set(posts.map((p) => p.data.date.getUTCFullYear()))];
---
<Base title="Archive">
  <Prompt cmd="ls -lR posts/" />
  {years.map((y) => (
    <section><h2 id={String(y)} class="mono">{y}/</h2>
      <PostList posts={posts.filter((p) => p.data.date.getUTCFullYear() === y)} /></section>
  ))}
</Base>
```

`src/pages/about.astro` (content carried over from `_pages/about.md`, plus a new agentic AI section):
```astro
---
import Base from '../layouts/Base.astro';
import Prompt from '../components/Prompt.astro';
import { SITE } from '../config';
---
<Base title="About" description="Andrej Trusevic — Cloud Engineer focused on Kubernetes, Azure and agentic AI.">
  <article class="prose" style="max-width: var(--measure)">
    <Prompt cmd="cat about.md" />
    <h1>Hello World. Welcome to sysadminas Cloud Blog.</h1>
    <p>I'm Andrej Trusevic, a Cloud Engineer focused on Kubernetes and Azure. I design and operate secure, scalable cloud-native infrastructure — from cluster architecture and GitOps delivery pipelines to security tooling and AI-assisted automation.</p>
    <h2>Certifications</h2>
    <p>I'm a <strong>Golden Kubestronaut</strong> — CNCF's recognition for practitioners who have earned every available Kubernetes and cloud-native certification. It's the highest tier in the Kubestronaut program, requiring a full sweep of CNCF credentials including CKA, CKS, CKAD, and the growing set of associate-level certifications (CGOA, CCA, CAPA, PCA, ICA, CNPA, KCA, and others). <a href="/certifications/">See all badges</a>.</p>
    <h2>What I Work With</h2>
    <ul>
      <li><strong>Kubernetes &amp; AKS</strong> — cluster design, upgrades, and day-2 operations on Azure Kubernetes Service</li>
      <li><strong>GitOps</strong> — Flux and Helm-based delivery pipelines for declarative workload management</li>
      <li><strong>Security</strong> — Trivy, Falco, Consul, policy enforcement, and supply chain hardening</li>
      <li><strong>AI-assisted DevOps</strong> — encoding operational knowledge into Claude Code skills and agents to automate routine platform engineering work</li>
    </ul>
    <h2>Agentic AI</h2>
    <p>I use agentic AI for day-to-day platform engineering: Claude Code skills that capture runbooks as reusable, reviewable workflows, subagents for parallel investigation, MCP servers that connect agents to clusters, metrics and CI/CD, and hooks for guardrails. Agents run read-only by default; any change needs a stated blast radius and explicit human approval.</p>
    <ul>
      <li><a href="/AI-Agents-and-Helm-Chart-Upgrades/">How AI Agents Changed My Helm Chart Upgrade Routine</a></li>
      <li><a href="/AKS-Issue-Analyzer-Claude-Skill/">Teaching Claude to Triage My AKS Clusters Before I Even Look</a></li>
    </ul>
    <h2>About This Blog</h2>
    <p>sysadminas.eu documents what I learn on the job. Posts cover practical Kubernetes and Azure topics, GitOps patterns, security tooling, and how AI is changing day-to-day platform engineering work. I write to share what I pick up and to give back to the community that has taught me most of what I know.</p>
    <p class="mono"><a href={SITE.cvPath} download>$ wget cv-andrej-trusevic.pdf</a></p>
  </article>
</Base>
```

`src/components/CertGrid.astro`:
```astro
---
import { CERT_BADGE_IDS } from '../data/certs';
---
<div class="cert-grid">
  {CERT_BADGE_IDS.map((id) => (
    <div class="cert" data-iframe-width="150" data-iframe-height="270" data-share-badge-id={id} data-share-badge-host="https://www.credly.com"></div>
  ))}
</div>
<script is:inline async src="https://cdn.credly.com/assets/utilities/embed.js"></script>
```

`src/pages/certifications.astro`:
```astro
---
import Base from '../layouts/Base.astro';
import Prompt from '../components/Prompt.astro';
import CertGrid from '../components/CertGrid.astro';
---
<Base title="Certifications" description="CNCF Golden Kubestronaut and Microsoft certifications.">
  <Prompt cmd="cat certs.yaml" />
  <h1 class="mono">certifications: <span class="muted"># CNCF Golden Kubestronaut + Microsoft</span></h1>
  <CertGrid />
</Base>
```

`src/pages/404.astro`:
```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Not found">
  <p class="prompt" style="margin-top:3rem"><span class="user">andrej@aks</span>:<span class="path">~</span>$ cd <span id="p"></span></p>
  <p class="mono">bash: cd: <span id="p2"></span>: command not found</p>
  <p class="mono"><a href="/">cd ~</a> · <a href="/year-archive/">ls posts/</a> · <button class="kbd" data-search-open>search</button></p>
  <script is:inline>document.getElementById('p').textContent=location.pathname;document.getElementById('p2').textContent=location.pathname;</script>
</Base>
```

CSS addition:
```css
.cert-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; margin: 1.5rem 0; }
.cert { min-height: 270px; }
.tag-cloud { display: flex; flex-wrap: wrap; gap: .4rem .9rem; font-size: .85rem; }
```

- [ ] **Step 5: Build, test and commit**

Run: `npx astro build && npm test && npm run test:dist`. Expected: PASS. Then check `/certifications/` in preview to confirm the badges load.

```bash
git add src tests
git commit -m "feat(pages): add tags, archive, about, certifications and 404 pages"
```

---

### Task 8: Feed, sitemap, robots, analytics, comments

**Files:**
- Create: `src/pages/feed.xml.ts`, `src/pages/sitemap.xml.ts`, `src/pages/robots.txt.ts`, `src/components/Giscus.astro`, `tests/dist/feeds.test.ts`
- Modify: `src/layouts/Base.astro` (GoatCounter), `src/pages/[slug].astro` (Giscus in the `after` slot)

**Interfaces:**
- Consumes: `getPublishedPosts`, `postUrl`, `SITE`, and the `theme-change` event (Task 2).
- Produces: `/feed.xml` (RSS 2.0, all published posts), `/sitemap.xml` (an index that points at `/sitemap-0.xml`), `/robots.txt`. `<Giscus />` renders nothing while `SITE.giscus.repoId` is empty.

- [ ] **Step 1: Write the failing test** in `tests/dist/feeds.test.ts`

```ts
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
```

Run: `npx astro build && npm run test:dist`. Expected: FAIL.

- [ ] **Step 2: Implement the endpoints**

`src/pages/feed.xml.ts`:
```ts
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../config';
import { getPublishedPosts, postUrl } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: posts.map((p) => ({ title: p.data.title, description: p.data.excerpt, pubDate: p.data.date, link: postUrl(p), categories: p.data.tags })),
  });
}
```

`src/pages/sitemap.xml.ts`:
```ts
export const GET = () => new Response(
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://sysadminas.eu/sitemap-0.xml</loc></sitemap></sitemapindex>\n`,
  { headers: { 'Content-Type': 'application/xml' } });
```

`src/pages/robots.txt.ts`:
```ts
export const GET = () => new Response('User-agent: *\nAllow: /\n\nSitemap: https://sysadminas.eu/sitemap-index.xml\n', { headers: { 'Content-Type': 'text/plain' } });
```

Exclude `/404/` and the `/sitemap.xml` endpoint from `@astrojs/sitemap` in `astro.config.mjs`:

```js
sitemap({ filter: (page) => !page.endsWith('/404/') })
```

- [ ] **Step 3: Add GoatCounter to `Base.astro`**, just before `</body>`:

```astro
{import.meta.env.PROD && <script is:inline data-goatcounter={SITE.goatcounter} async src="https://gc.zgo.at/count.js"></script>}
```

- [ ] **Step 4: Write `src/components/Giscus.astro`** and use it

```astro
---
import { SITE } from '../config';
const g = SITE.giscus;
const enabled = Boolean(g.repoId && g.categoryId);
---
{enabled && (
  <section class="comments">
    <p class="prompt">$ comments --thread</p>
    <script is:inline src="https://giscus.app/client.js" data-repo={g.repo} data-repo-id={g.repoId}
      data-category={g.category} data-category-id={g.categoryId} data-mapping="pathname" data-strict="1"
      data-reactions-enabled="1" data-emit-metadata="0" data-input-position="top" data-theme="dark"
      data-lang="en" data-loading="lazy" crossorigin="anonymous" async></script>
  </section>
)}
<script>
  const sync = (theme: string) => {
    const frame = document.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
    frame?.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app');
  };
  document.addEventListener('theme-change', (e) => sync((e as CustomEvent<string>).detail));
  window.addEventListener('message', (e) => {
    if (e.origin === 'https://giscus.app') sync(document.documentElement.dataset.theme ?? 'dark');
  }, { once: true });
</script>
```

In `src/pages/[slug].astro`, import `Giscus` and render `<Post …><Content /><Giscus slot="after" /></Post>`.

- [ ] **Step 5: Build, test and commit**

Run: `npx astro build && npm run test:dist`. Expected: PASS.

```bash
git add src tests astro.config.mjs
git commit -m "feat(meta): add RSS feed, sitemap, robots, GoatCounter and Giscus"
```

---

### Task 9: Pagefind search overlay

**Files:**
- Create: `src/components/Search.astro`, `tests/dist/search.test.ts`
- Modify: `src/layouts/Base.astro` (include Search)

**Interfaces:**
- Consumes: `data-search-open` buttons (Nav, 404) and `data-pagefind-body` (Post).
- Produces: a `<dialog id="search-dialog">` opened by `/`, ⌘K/Ctrl-K or a `[data-search-open]` click. It loads `/pagefind/pagefind-ui.js` and `.css` lazily on first open.

- [ ] **Step 1: Write the failing test** in `tests/dist/search.test.ts`

```ts
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
```

Run: `npm run build && npm run test:dist`. `npm run build` includes `pagefind --site dist`. Expected: FAIL on the dialog. The index assertion may already pass.

- [ ] **Step 2: Write `src/components/Search.astro`**

```astro
<dialog id="search-dialog" aria-label="Search posts">
  <form method="dialog" class="search-close"><button class="kbd" aria-label="Close search">esc</button></form>
  <div id="search"></div>
</dialog>
<script>
  const dialog = document.getElementById('search-dialog') as HTMLDialogElement;
  let loaded = false;
  async function open() {
    if (!loaded) {
      loaded = true;
      const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/pagefind/pagefind-ui.css'; document.head.appendChild(css);
      await new Promise<void>((res, rej) => { const s = document.createElement('script'); s.src = '/pagefind/pagefind-ui.js'; s.onload = () => res(); s.onerror = () => rej(); document.head.appendChild(s); })
        .then(() => new (window as any).PagefindUI({ element: '#search', showSubResults: true, resetStyles: false }))
        .catch(() => { document.getElementById('search')!.textContent = 'search index unavailable (run npm run build)'; });
    }
    dialog.showModal();
    (dialog.querySelector('input') as HTMLInputElement | null)?.focus();
  }
  document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', open));
  document.addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]');
    if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); open(); }
  });
</script>
<style is:global>
  #search-dialog { width: min(720px, calc(100vw - 32px)); max-height: 80vh; background: var(--bg-soft); color: var(--fg); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; }
  #search-dialog::backdrop { background: rgb(0 0 0 / .6); }
  .search-close { text-align: right; }
  #search { --pagefind-ui-scale: .85; --pagefind-ui-primary: var(--accent); --pagefind-ui-text: var(--fg); --pagefind-ui-background: var(--bg); --pagefind-ui-border: var(--border); --pagefind-ui-tag: var(--code-bg); --pagefind-ui-font: var(--font-mono); }
</style>
```

Add `<Search />` to `Base.astro` right after `<Nav … />`.

- [ ] **Step 3: Build, test, try it and commit**

Run: `npm run build && npm run test:dist`. Expected: PASS. Then `npx astro preview`, press `/`, and search for `kyverno`. The results should link to post pages.

```bash
git add src tests
git commit -m "feat(search): add Pagefind search overlay with / and Cmd-K shortcuts"
```

---

### Task 10: Legacy URL check and CI deploy workflow

**Files:**
- Create: `scripts/check-urls.mjs`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `scripts/legacy-urls.txt` (Task 5) and `dist/`.
- Produces: `npm run check:urls`, which exits 1 and lists every missing path. The workflow builds on PRs and on pushes to `master`, and deploys to Pages on `master` only.

- [ ] **Step 1: Write `scripts/check-urls.mjs`**

```js
import { readFileSync, existsSync } from 'node:fs';

const paths = readFileSync('scripts/legacy-urls.txt', 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const toFile = (p) => `dist${p.endsWith('/') ? `${p}index.html` : p}`;
const missing = paths.filter((p) => !existsSync(toFile(p)));
if (missing.length) {
  console.error(`Missing ${missing.length}/${paths.length} legacy URLs:\n${missing.map((m) => `  ${m}`).join('\n')}`);
  process.exit(1);
}
console.log(`All ${paths.length} legacy URLs present.`);
```

- [ ] **Step 2: Prove that it fails when something is missing, then passes**

Run: `npm run build && mv dist/CKA dist/CKA.bak && npm run check:urls; echo "exit=$?"; mv dist/CKA.bak dist/CKA && npm run check:urls`. Expected: the first run prints `Missing 1/47 … /CKA/` and `exit=1`. The second prints `All 47 legacy URLs present.`

- [ ] **Step 3: Write `.github/workflows/deploy.yml`**

```yaml
name: Build and deploy
on:
  push: { branches: [master] }
  pull_request:
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency: { group: pages, cancel-in-progress: false }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm run test:dist
      - run: npm run check:urls
      - uses: actions/upload-pages-artifact@v3
        if: github.ref == 'refs/heads/master'
        with: { path: dist }
  deploy:
    if: github.ref == 'refs/heads/master'
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: '${{ steps.deployment.outputs.page_url }}' }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Run the full local pipeline**

Run: `rm -rf dist && npm ci && npm test && npm run build && npm run test:dist && npm run check:urls`. Expected: everything is green.

- [ ] **Step 5: Lighthouse.** Run `npx astro preview`, then `npx -y lighthouse http://localhost:4321/ --only-categories=performance,accessibility,seo --quiet --chrome-flags=--headless`, and repeat for `/AKS-Issue-Analyzer-Claude-Skill/`. Expected: ≥ 95 in each category. If accessibility is below 95, the usual cause is `--muted` text contrast. Lighten `--muted` in dark mode (or darken it in light mode) until it passes, and re-run.

- [ ] **Step 6: Commit and push the branch** (pushing the PR branch runs the workflow's build job only)

```bash
git add scripts .github
git commit -m "ci(pages): add legacy URL check and GitHub Actions build/deploy workflow"
git push -u origin astro
```

Open a PR `astro` → `master`. CI must be green before Task 11.

---

### Task 11: Cutover (needs the user for the GitHub settings steps)

**Files:**
- Modify: `src/config.ts` (Giscus ids)
- Delete: `_config.yml`, `Gemfile`, `.travis.yml`, `staticman.yml`, `Rakefile`, `banner.js`, `index.html`, `_layouts/`, `_includes/`, `_sass/`, `_data/`, `_pages/`, `_posts/`, `_drafts/`, `tags/`, `README.MD` (replaced)
- Keep: `_resume/`, `docs/`, `LICENSE`

- [ ] **Step 1: User: enable Giscus.** Repo Settings → General → Features → tick **Discussions**. Install https://github.com/apps/giscus on `andriktr/andriktr.github.io`. On https://giscus.app enter the repo, choose mapping "pathname" and category "Announcements", and copy `data-repo-id` and `data-category-id`.
- [ ] **Step 2: Put those ids into `src/config.ts`** (`giscus.repoId`, `giscus.categoryId`). Build, open a post in preview, and confirm the comment box loads and follows the theme toggle.
- [ ] **Step 3: User: create GoatCounter.** Sign up at https://www.goatcounter.com with the code `sysadminas`, so the endpoint is `https://sysadminas.goatcounter.com/count`. If that code is taken, update `SITE.goatcounter`.
- [ ] **Step 4: Remove the Jekyll files** on the `astro` branch

```bash
git rm -r _config.yml Gemfile .travis.yml staticman.yml Rakefile banner.js index.html _layouts _includes _sass _data _pages _posts _drafts tags README.MD
```

Write a new `README.md` covering: what the site is, `npm run dev`, `npm run build`, `npm test`, `npm run test:dist`, how to add a post (front matter fields from `src/content.config.ts`, plus images under `public/assets/images/postNN/`), and how to regenerate the CV (the command in `_resume/cv-andrej-trusevic.html`). Remove the Ruby/Jekyll entries from `.gitignore`.

Run: `rm -rf dist && npm run build && npm test && npm run test:dist && npm run check:urls`. Expected: green.

```bash
git add -A
git commit -m "chore(cutover): remove Jekyll theme and sources, add README for the Astro site"
git push
```

- [ ] **Step 5: User: switch the Pages source.** Settings → Pages → Build and deployment → Source: **GitHub Actions**. The custom domain `sysadminas.eu` stays set, and `public/CNAME` is deployed as well.
- [ ] **Step 6: Merge the PR** `astro` → `master`. The workflow builds and deploys.
- [ ] **Step 7: Verify production**

```bash
for p in $(cat scripts/legacy-urls.txt); do printf "%s %s\n" "$(curl -s -o /dev/null -w '%{http_code}' "https://sysadminas.eu$p")" "$p"; done | grep -v '^200' || echo "all 200"
curl -s -o /dev/null -w '%{http_code}\n' https://sysadminas.eu/helm-charts/index.yaml   # expect 200
```

Also open `/`, a post, `/certifications/` and search on a phone-width window.

- [ ] **Rollback, if needed:** Settings → Pages → Source: "Deploy from a branch", choose `master` / root, then `git revert -m 1 <merge-sha> && git push`.

---

## Self-review notes

- **Spec coverage:**
  - §3 URLs → Tasks 5–8 and 10
  - §4 structure → Tasks 1–9
  - §5.1 → Task 4, §5.2 → Task 3, §5.3 → Task 6
  - §6 components → Tasks 2, 5, 7, 8 and 9
  - §7 → Tasks 10 and 11, §8 → the dist tests in every task plus Task 10
  - §9 risks → URL check (Task 10) and the helm-charts check (Task 11 Step 7)
  - The SEO bio typo ("Goldent") disappears with `_config.yml`, and the new copy in `SITE`/About is correct.
- **Deviation from the spec:** the front-matter field is `urlSlug`, not `slug`, because the glob loader reserves `slug` for entry ids.
