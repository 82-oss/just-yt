import type { APIRoute } from 'astro';

const sources = import.meta.glob('../../content/docs/**/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

export function getStaticPaths() {
  return Object.entries(sources).map(([path, source]) => ({
    params: {
      slug: path.replace('../../content/docs/', '').replace(/\.md$/, ''),
    },
    props: { source },
  }));
}

export const GET: APIRoute = ({ props }) =>
  new Response(props.source as string, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
