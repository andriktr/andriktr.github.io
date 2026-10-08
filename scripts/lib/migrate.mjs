const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
export const TAG_ALIASES = {
  K8S: 'Kubernetes', k8s: 'Kubernetes', Github: 'GitHub', AzureDevOps: 'Azure DevOps', ADO: 'Azure DevOps',
  FluxCD: 'Flux', GO: 'Go', Golang: 'Go', AAD: 'Azure AD', AzureAD: 'Azure AD', Container: 'Containers',
  Charts: 'Helm Chart', DB: 'Database', 'Argo CD': 'Argo CD', Argo: 'Argo CD', Aqua: 'Aquasec',
  Keyvault: 'KeyVault', kyverno: 'Kyverno', Images: 'Image',
};

export function parseLegacyDate(s) {
  if (s instanceof Date) return s.toISOString().slice(0, 10);
  const m = String(s).trim().match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) throw new Error(`Unrecognised date: ${s}`);
  const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
  if (!month) throw new Error(`Unrecognised month: ${s}`);
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

export const slugFromFilename = (f) => f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-[\dx]{2}-/, '');

export function normaliseTag(t) {
  const trimmed = String(t).trim();
  return TAG_ALIASES[trimmed] ?? trimmed;
}

export function transformFrontmatter(data, filename, { draft }) {
  const tags = [...new Set((data.tags ?? []).map(normaliseTag))];
  return {
    title: String(data.title).trim(),
    excerpt: String(data.excerpt ?? '').trim(),
    date: parseLegacyDate(data.date),
    urlSlug: slugFromFilename(filename),
    tags,
    toc: data.toc !== false,
    draft,
  };
}
