import { describe, it, expect } from 'vitest';
import { tagSlug } from '../../src/lib/tags';

describe('tagSlug matches Jekyll slugify for legacy anchors', () => {
  it.each([
    ['Kubernetes', 'kubernetes'], ['Claude Code', 'claude-code'], ['CI/CD', 'ci-cd'],
    ['Azure DevOps', 'azure-devops'], ['Trivy-Operator', 'trivy-operator'], ['OCI Registry', 'oci-registry'],
  ])('%s → %s', (input, expected) => expect(tagSlug(input)).toBe(expected));
});
