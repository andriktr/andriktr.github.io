export const tagSlug = (tag: string) =>
  tag.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

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
