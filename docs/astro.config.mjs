// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { codeTheme } from './src/lib/code-theme.mjs';
import {
  calloutHastPlugin,
  docCardsHastPlugin,
  docChromeHastPlugin,
  docChromePlugin,
  tableScrollPlugin,
} from './src/lib/markdown-plugins.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://just-yt.dev',

  // `/` is the landing page; every doc lives under `/docs/`. Bare `/docs` has
  // no page of its own, so it lands on the opening one.
  redirects: {
    '/docs': '/docs/getting-started',
  },

  fonts: [
    {
      name: 'Inter',
      cssVariable: '--font-sans',
      provider: fontProviders.google(),
      weights: [400, 500, 600, 700],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
    },
    {
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      provider: fontProviders.google(),
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin'],
      display: 'swap',
    },
  ],

  markdown: {
    shikiConfig: {
      theme: codeTheme,
      wrap: false,
    },
    processor: satteri({
      // `directive` powers `:::tabs` and the callouts; see src/lib/markdown-plugins.mjs.
      features: { directive: true },
      mdastPlugins: [docChromePlugin],
      hastPlugins: [tableScrollPlugin, docChromeHastPlugin, calloutHastPlugin, docCardsHastPlugin],
    }),
  },

  vite: {
    server: {
      allowedHosts: ['kenobi'],
    },
  },
});
