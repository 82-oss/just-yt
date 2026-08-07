import landingSource from '../content/landing/index.md?raw';

export const GET = () =>
  new Response(landingSource, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  });
