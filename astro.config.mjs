import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkLegacy from './src/plugins/remark-legacy.ts';

export default defineConfig({
  site: 'https://sysadminas.eu',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [remarkLegacy],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
});
