# sysadminas.eu

Personal blog of Andrej Trusevic (Kubernetes, Azure, GitOps, agentic AI). Astro static site, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `master`. See `README.md` for commands.

## Hard rules

- **Never change the URL of a published post.** URLs come from `urlSlug` in front matter and are case-sensitive; `scripts/legacy-urls.txt` lists URLs that must keep working. Don't edit that file to make a check pass.
- **Never commit real credentials** in post examples: keys, SAS tokens, service principal secrets, kubeconfigs, connection strings. Use obvious placeholders like `<storage-account-key>`.
- Work through a pull request. Don't push to `master`.

## Before opening or updating a PR

All of these must pass:

```bash
npm test && npm run build && npm run test:dist && npm run check:urls
```

## Adding a post

- File: `src/content/posts/<Name>.md`. Front matter is validated by `src/content.config.ts`:

  ```md
  ---
  title: "…"
  excerpt: "One-line summary (home page, RSS, search)."
  date: 2026-10-08
  urlSlug: My-New-Post   # letters, digits, '-' only
  tags: [Kubernetes, AKS]
  draft: true            # until the author says to publish
  ---
  ```

- Reuse existing tags (see the `tags:` in other posts) instead of inventing near-duplicates.
- Images go in a new `public/assets/images/postNN/` folder, where NN is one higher than the last existing folder. Reference them as `/assets/images/postNN/<file>`.
- A table of contents appears automatically once a post has 3+ `##`/`###` headings.
- Code blocks render `{{ }}` literally; no escaping is needed.
- Write in the author's voice: first person, practical, hands-on, with commands the reader can run.

## Layout

- `src/pages/`: routes. `src/layouts/`: `Base.astro` (head, nav) and `Post.astro`.
- `src/components/`, `src/styles/` (`tokens.css` holds the dark and light colour tokens).
- `src/plugins/remark-legacy.ts`: converts old Jekyll syntax in migrated posts. Don't remove it.
- `src/config.ts`: site settings, nav, Giscus and GoatCounter ids.
- `_resume/cv-andrej-trusevic.html`: CV source. The PDF in `public/assets/docs/` is generated from it (command in the file's header comment).
- Tests: `tests/unit/` (vitest) and `tests/dist/` (run against the built `dist/`).
