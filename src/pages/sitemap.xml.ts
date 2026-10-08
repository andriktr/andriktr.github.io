export const GET = () => new Response(
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://sysadminas.eu/sitemap-0.xml</loc></sitemap></sitemapindex>\n`,
  { headers: { 'Content-Type': 'application/xml' } });
