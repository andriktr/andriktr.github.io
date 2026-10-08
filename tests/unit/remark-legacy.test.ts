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
  it('restores class names mangled by smartypants dashes', async () => {
    const out = await render('Careful here.\n{: .notice—info}');
    expect(out).toBe('<aside class="notice notice--info">Careful here.</aside>');
  });
  it('adds empty alt, lazy loading and async decoding to raw html img tags lacking them', async () => {
    const out = await render('<img align="right" width="400" height="300" src="../assets/images/post31/1.png">\n');
    expect(out).toContain('alt=""');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
  });
  it('keeps existing alt/loading on raw html img tags', async () => {
    const out = await render('<img alt="Diagram" loading="eager" src="/a.png">\n');
    expect(out).toContain('alt="Diagram"');
    expect(out).toContain('loading="eager"');
    expect(out).not.toContain('alt=""');
    expect((out.match(/loading=/g) || []).length).toBe(1);
  });
});
