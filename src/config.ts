export const SITE = {
  title: 'sysadminas.eu',
  url: 'https://sysadminas.eu',
  author: 'Andrej Trusevic',
  role: 'Cloud Engineer',
  badge: 'CNCF Golden Kubestronaut',
  topics: ['golden-kubestronaut', 'azure', 'agentic-ai'],
  description: 'Practical Kubernetes, Azure and AI-assisted platform engineering.',
  twitter: '@andriktr',
  postsPerPage: 5,
  cvPath: '/assets/docs/cv-andrej-trusevic.pdf',
  goatcounter: 'https://andriktr.goatcounter.com/count',
  giscus: {
    repo: 'andriktr/andriktr.github.io',
    repoId: 'MDEwOlJlcG9zaXRvcnkzMjY1OTExMjM=',
    category: 'Announcements',
    categoryId: 'DIC_kwDOE3dik84DHVDs',
  },
} as const;

export const NAV = [
  { label: 'posts', href: '/' },
  { label: 'about', href: '/about/' },
  { label: 'cv', href: SITE.cvPath, download: true },
  { label: 'certs', href: '/certifications/' },
] as const;
