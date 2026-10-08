import type { Root, Paragraph, Text, Parent, RootContent } from 'mdast';
import { visit, SKIP } from 'unist-util-visit';

const IAL_TAIL = /(?:\s*\n?\{:\s*([^}]*)\}\s*)+$/;
const IAL_ONLY = /^(?:\s*\{:\s*[^}]*\}\s*)+$/;
const FA_ICON = /^<i class="fa[rsb]? fa-[\w-]+"><\/i>$/;
const FA_OPEN = /^<i class="fa[rsb]? fa-[\w-]+">$/;

function classesFrom(ial: string): string[] {
  return [...ial.matchAll(/\{:\s*([^}]*)\}/g)]
    // Astro runs remark-smartypants before user plugins, which turns `notice--info` into `notice—info`
    .flatMap((m) => m[1].replace(/—/g, '--').replace(/–/g, '-').split(/\s+/))
    .filter((t) => t.startsWith('.'))
    .map((t) => t.slice(1));
}

function applyClasses(node: RootContent, classes: string[]) {
  const notice = classes.filter((c) => c === 'notice' || c.startsWith('notice--'));
  if (!notice.length || node.type !== 'paragraph') return;
  node.data = { ...node.data, hName: 'aside', hProperties: { className: ['notice', ...notice.filter((c) => c !== 'notice')] } };
}

// legacy raw <img> tags are decorative covers: give them empty alt and lazy/async loading when absent
function fixImgTags(html: string): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const add = [
      /\salt\s*=/i.test(tag) ? '' : ' alt=""',
      /\sloading\s*=/i.test(tag) ? '' : ' loading="lazy"',
      /\sdecoding\s*=/i.test(tag) ? '' : ' decoding="async"',
    ].join('');
    return add ? tag.replace(/^<img\b/i, `<img${add}`) : tag;
  });
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
        node.value = fixImgTags(node.value);
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
