# sysadminas.eu

Source of [sysadminas.eu](https://sysadminas.eu), a personal blog about sysadmin and DevOps topics. It is a static site built with [Astro](https://astro.build), with full-text search by Pagefind, and deployed to GitHub Pages by the workflow in `.github/workflows`.

## Commands

| Command | What it does |
| --- | --- |
| `npm ci` | Install dependencies |
| `npm run dev` | Start the dev server |
| `npm run build` | Build the site into `dist/` and index it for search |
| `npm test` | Unit tests (vitest) |
| `npm run test:dist` | Tests against the built `dist/` (run `npm run build` first) |
| `npm run check:urls` | Check that every legacy URL in `scripts/legacy-urls.txt` still exists in `dist/` |

## Adding a post

Create a Markdown file in `src/content/posts/`. Front matter fields (see `src/content.config.ts`):

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | Required |
| `excerpt` | string | Optional, default empty |
| `date` | date | Required, e.g. `2026-10-08` |
| `urlSlug` | string | Required. The URL path (`/<urlSlug>/`), letters, digits and `-` only. Case-sensitive |
| `tags` | list of strings | Optional |
| `toc` | boolean | Table of contents, default `true` |
| `draft` | boolean | Drafts are not published, default `false` |

```md
---
title: "My new post"
excerpt: "One-line summary."
date: 2026-10-08
urlSlug: My-New-Post
tags: [kubernetes, helm]
toc: true
draft: false
---

Post body in Markdown.

![Diagram](/assets/images/post32/diagram.png)
```

Images go in `public/assets/images/postNN/` and are referenced as `/assets/images/postNN/<file>`.

## Regenerating the CV

`_resume/cv-andrej-trusevic.html` is the source of `public/assets/docs/cv-andrej-trusevic.pdf`. The command is in the comment at the top of the HTML file; from the repo root:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --no-pdf-header-footer \
  --print-to-pdf=public/assets/docs/cv-andrej-trusevic.pdf _resume/cv-andrej-trusevic.html
```

## Cutover and rollback

1. Giscus: Discussions are enabled and the giscus app is installed; `repoId` and `categoryId` are set in `src/config.ts` (mapping: pathname, category: Announcements).
2. GoatCounter: site code `andriktr` (stats at https://andriktr.goatcounter.com); endpoint set in `SITE.goatcounter`.
3. In Settings, Pages, set Source to **GitHub Actions** BEFORE merging `astro` into `master`. Merging first would make GitHub's Jekyll build serve a broken site.
4. Merge `astro` into `master` and watch the Pages workflow. Then verify every legacy URL and the Helm repo index:

   ```bash
   while read -r u; do printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "https://sysadminas.eu$u")" "$u"; done < scripts/legacy-urls.txt
   curl -sI https://sysadminas.eu/helm-charts/index.yaml | head -1
   ```

5. Rollback: revert the merge commit and push, then switch Pages Source back to "Deploy from a branch: master /(root)".

## Notes

- `npm run migrate` converted the old Jekyll posts into `src/content/posts/`. It was a one-off and has already been run. The Jekyll sources it reads (`_posts`, `_drafts`) have been removed, so the script is kept for reference only.
- Design spec and implementation plan are in `docs/`.
