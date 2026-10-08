import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import matter from 'gray-matter';
import * as yaml from 'js-yaml';
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
