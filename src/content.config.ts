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
