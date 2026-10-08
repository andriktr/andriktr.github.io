import { readFileSync, existsSync } from 'node:fs';

const paths = readFileSync('scripts/legacy-urls.txt', 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
const toFile = (p) => `dist${p.endsWith('/') ? `${p}index.html` : p}`;
const missing = paths.filter((p) => !existsSync(toFile(p)));
if (missing.length) {
  console.error(`Missing ${missing.length}/${paths.length} legacy URLs:\n${missing.map((m) => `  ${m}`).join('\n')}`);
  process.exit(1);
}
console.log(`All ${paths.length} legacy URLs present.`);
