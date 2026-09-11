import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_URL, SITE_NAME } from '../utils/seo';
import { blogPath, withTrailingSlash } from '../utils/paths';

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export const GET: APIRoute = async () => {
  const posts = await getCollection('blog');
  const now = new Date().toUTCString();

  const items = posts
    .map((post) => {
      const url = `${SITE_URL}${blogPath(post.slug)}`;
      const title = escapeXml(post.data.titulo);
      const description = escapeXml(post.data.descripcion ?? '');
      return `    <item>
      <title>${title}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${description}</description>
      <pubDate>${now}</pubDate>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(SITE_NAME)} — Blog</title>
    <link>${SITE_URL}${withTrailingSlash('/blog')}</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <description>Artículos, guías y consejos para el cuidado de tu perro.</description>
    <language>es-ES</language>
    <lastBuildDate>${now}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
