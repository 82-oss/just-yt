import type { APIRoute } from 'astro';
import { render } from 'astro:content';
import { docHref, getSortedDocs } from '../lib/docs';

/**
 * Static search index, fetched by the ⌘K dialog on first open.
 *
 * Five pages is far too small to justify shipping a search library, so this is
 * plain text plus headings and the client scores it directly.
 */
export const GET: APIRoute = async () => {
  const docs = await getSortedDocs();

  const index = await Promise.all(
    docs.map(async (doc) => {
      const { headings } = await render(doc);
      const href = docHref(doc);

      return {
        href,
        title: doc.data.title,
        description: doc.data.description,
        group: doc.data.group,
        headings: headings
          .filter((heading) => heading.depth === 2 || heading.depth === 3)
          .map((heading) => ({ text: heading.text, href: `${href}#${heading.slug}` })),
        body: toPlainText(doc.body ?? ''),
      };
    }),
  );

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/** Strips markdown syntax so snippets read as prose rather than source. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`([^`]*)`/g, '$1') // inline code, keep the identifier
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links, keep the text
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ') // headings
    .replace(/^\s{0,3}>\s?/gm, ' ') // blockquotes
    .replace(/^\s{0,3}[-*+]\s+/gm, ' ') // bullets
    .replace(/^\s*\|[\s:|-]+\|\s*$/gm, ' ') // table rules
    .replace(/\|/g, ' ') // table cell separators
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
