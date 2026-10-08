import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkLegacy from './src/plugins/remark-legacy.ts';

export default defineConfig({
  site: 'https://sysadminas.eu',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.endsWith('/404/') })],
  markdown: {
    processor: unified({ remarkPlugins: [remarkLegacy] }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      // Preload YAML so front matter inside ```markdown blocks is always highlighted;
      // Shiki only colours embedded YAML if the grammar is already loaded.
      langs: ['yaml'],
      wrap: false,
    },
  },
});
