# sysadminas.eu redesign — design spec

Date: 2026-10-08 · Branch: `astro` · Status: awaiting review

## 1. Goal

Replace the Jekyll + Minimal Mistakes (4.21.0, vendored) site with a new, modern, self-owned Astro site in a **terminal / dev-tool** visual style. The site stays **blog-first, portfolio second** (About, CV, certifications, agentic AI). No existing URL may break.

### Success criteria
- Every URL in the current live `sitemap.xml`, plus `/feed.xml` and `/assets/docs/cv-andrej-trusevic.pdf`, resolves on the new site.
- Code blocks containing `{{ … }}` (5 posts, ~213 occurrences) render their contents (today Liquid blanks them).
- Lighthouse ≥ 95 for Performance, Accessibility and SEO on `/` and one long post, in both colour schemes.
- `sysadminas.eu/helm-charts/` (served by the separate `andriktr/helm-charts` Pages site) keeps working.
- Rollback is one settings change.

### Non-goals (this iteration)
Projects page, hero images on the home list, newsletter, i18n, migrating Disqus comments.

## 2. Decisions

| Topic | Decision |
|---|---|
| Stack | Astro (latest stable), static output, custom theme (no third-party theme) |
| Hosting | GitHub Pages, deployed by GitHub Actions; `CNAME` = `sysadminas.eu`; `site` = `https://sysadminas.eu` |
| Visual style | Terminal / dev-tool: monospace chrome, prompt-style headings (`$ cat post.md`), green accent; readable sans for body text |
| Colour schemes | Dark default + light, toggle in nav, respects `prefers-color-scheme`, remembered per visitor (localStorage, try/catch) |
| Post layout | Sticky TOC on the right with active-section highlight; collapses to a top dropdown under ~1024px |
| Comments | Giscus (GitHub Discussions on this repo). Old Disqus threads are not migrated |
| Analytics | GoatCounter (`sysadminas.goatcounter.com`), cookieless, no consent banner |
| Search | Pagefind, static index built in CI, opened with `/` or ⌘K |
| Code highlighting | Shiki (built into Astro), dual dark/light themes, language label + copy button |

## 3. Information architecture & URLs

| Page | URL | Notes |
|---|---|---|
| Home | `/` | `whoami` intro block, then posts as `ls -t` list; pagination 5/page at `/page2/`, `/page3/` … (matches Jekyll `paginate_path: /page:num/`) |
| Post | `/<Slug>/` | Slug = Jekyll filename slug, **case preserved**, trailing slash |
| Year archive | `/year-archive/` | Grouped by year |
| Tags index | `/tags/` | All tags with counts; old `/tags/#anchor` links land here (anchors kept as element ids) |
| Tag page | `/tags/<tag-slug>/` | New |
| About | `/about/` | Existing bio + agentic AI section linking AI posts |
| Certifications | `/certifications/` | Same 18 Credly badge embeds, in a terminal-styled grid |
| CV | `/assets/docs/cv-andrej-trusevic.pdf` | Same path; nav link keeps `download` |
| Feed | `/feed.xml` | RSS, full post list; path preserved for subscribers |
| Sitemap | `/sitemap-index.xml` (from `@astrojs/sitemap`) and `/sitemap.xml` | `src/pages/sitemap.xml.ts` emits a sitemap index pointing at the same files, so the old path keeps working; `robots.txt` references `/sitemap-index.xml` |
| 404 | `/404.html` | `bash: <path>: command not found` |

Nav: `[posts] [about] [cv] [certs]`, search key hint, theme toggle.

## 4. Project structure

```
astro.config.mjs            site, trailingSlash: 'always', build.format: 'directory', integrations
src/
  content.config.ts         posts collection + zod schema
  content/posts/*.md        31 migrated posts (+ 1 draft with draft: true, excluded from production builds)
  layouts/Base.astro        <head>, SEO/OG tags, nav, theme toggle, search, GoatCounter
  layouts/Post.astro        article, meta, Toc, Giscus
  components/               Prompt, PostList, Pagination, Toc, TagList, CertGrid, Search, ThemeToggle
  pages/
    index.astro, page[num].astro → /page2/ … (see 5.3)
    [slug].astro            one route per post, slug from frontmatter/filename
    tags/index.astro, tags/[tag].astro
    year-archive.astro, about.astro, certifications.astro, 404.astro
    feed.xml.ts
  plugins/remark-legacy.ts  Jekyll compatibility (see 5.2)
  styles/tokens.css         colour/spacing/type tokens for dark and light
public/
  assets/images/**, assets/docs/**   copied unchanged (paths preserved)
  favicons, site.webmanifest (name filled in), browserconfig.xml, CNAME
scripts/migrate-posts.mjs   one-off migration (kept for reference)
scripts/check-urls.mjs      old-sitemap → dist URL check
.github/workflows/deploy.yml
```

### Post schema
```ts
{ title: string, excerpt: string, date: Date, tags: string[],
  toc: boolean (default true), draft: boolean (default false),
  slug: string (exact legacy slug) }
```
Build fails on schema violations.

## 5. Content migration

### 5.1 Migration script (`scripts/migrate-posts.mjs`, run once, output committed)
- Copy `_posts/*.md` → `src/content/posts/`, `_drafts/*.md` → same with `draft: true` (skip `blank.md`).
- `date: August 02, 2019` → `2019-08-02`.
- Add explicit `slug` from filename (case preserved).
- Drop `toc_label`, `toc_sticky` (now defaults).
- Normalise tags through a mapping table (e.g. `K8S`→`Kubernetes`); tag slugs are lowercase-hyphenated (`Claude Code` → `claude-code`, `CI/CD` → `ci-cd`).
- Fix the one broken internal link (`Part-2-Azure-SQL-DB-backups-Configure-the-backups`) to the real slug.
- Body otherwise untouched.

### 5.2 Rendering compatibility (`remark-legacy`)
- Kramdown IAL `{: .notice--info}` on the preceding paragraph → `<aside class="notice notice--info">` rendered as `[NOTE]` callout; `{: .text-justify}` → stripped (justify not used in new design).
- Relative image paths `../assets/images/…` (markdown and raw `<img>`) → `/assets/images/…`.
- Raw `<img align="right" width=… height=…>` keep working via CSS (`img[align=right]` floats right, max-width 45%, stacks on mobile; `height` ignored to preserve aspect ratio).
- Font Awesome `<i class="far fa-sticky-note">` icons: removed by the plugin (the `[NOTE]` label replaces them).
- No Liquid processing at all, so `{{ }}` renders literally.

### 5.3 Pagination
Jekyll used `/page2/`, `/page3/` …; Astro's `paginate()` defaults to `/page/2/`. Use a route file with a static prefix inside the segment, `src/pages/page[num].astro`, whose `getStaticPaths` returns `num: 2..N` (5 posts per page). The static `page` prefix gives it priority over the root `[slug].astro` route. Page 1 is `/`. The URL check verifies every `/pageN/`.

## 6. Components & behaviour

- **ThemeToggle**: inline script in `<head>` sets `data-theme` before paint (no flash).
- **Toc**: built from rendered headings (h2–h3); `IntersectionObserver` highlights the active one; hidden when `toc: false` or fewer than 3 headings.
- **Search**: Pagefind UI styled with tokens; index built after `astro build` in CI (`npx pagefind --site dist`).
- **Giscus**: lazy-loaded at end of post; theme follows site theme (postMessage on toggle). Mapping: `pathname`.
- **GoatCounter**: single async `<script data-goatcounter=…>`; skipped on localhost.
- **CertGrid**: Credly embed script loaded once (not 18 times), badges in a responsive grid.
- **SEO**: canonical `https://sysadminas.eu/<path>/`, OG/Twitter tags (twitter `@andriktr`), per-post description = excerpt. Fix author bio typo ("Goldent").

## 7. Deployment & cutover

1. Work on branch `astro`. `master` (Jekyll) stays live.
2. `deploy.yml`: on push to `master` → `npm ci` → `astro build` → `pagefind` → `check-urls` → `actions/upload-pages-artifact` → `actions/deploy-pages`. On PRs: build + checks only.
3. User one-time steps (guided): enable Discussions + install giscus app; create GoatCounter site; Settings → Pages → Source: **GitHub Actions**.
4. Merge `astro` → `master`; old Jekyll files (`_layouts`, `_includes`, `_sass`, `_config.yml`, `Gemfile`, `.travis.yml`, `staticman.yml`, `Rakefile`, `banner.js`, old `package.json`, `assets/js`, `assets/css`) removed in that merge. `_resume/` kept.
5. **Rollback**: Pages source back to "Deploy from branch: master" after reverting the merge commit.

## 8. Testing

- Build-time: zod schema; internal link + image existence check over `dist/`.
- `scripts/check-urls.mjs`: fetch current live `https://sysadminas.eu/sitemap.xml` once, save as fixture `scripts/legacy-urls.txt` (plus feed, CV, `/pageN/`), assert every path exists in `dist/` — runs in CI.
- Manual: preview locally; spot-check the 5 `{{ }}` posts, a post with right-aligned images, notices, the certifications page, mobile width, both themes.
- Lighthouse on `/` and the AKS triage post (local preview).

## 9. Risks

| Risk | Mitigation |
|---|---|
| Mixed-case URLs lowercased by tooling | Explicit `slug` in frontmatter; URL check in CI |
| Pagination path mismatch | Covered by URL check fixture |
| Disqus history lost | Accepted (decision); old threads stay viewable on disqus.com |
| Pages source switch breaks `/helm-charts/` | Project Pages sites are independent of the user-site source; verify after cutover |
| Credly embed slow / layout shift | Load script once, reserve badge box size |
