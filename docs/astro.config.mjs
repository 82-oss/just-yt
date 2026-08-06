// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { codeThemeDark, codeThemeLight } from './src/lib/code-theme.mjs';
import {
  calloutHastPlugin,
  docChromeHastPlugin,
  docChromePlugin,
  tableScrollPlugin,
} from './src/lib/markdown-plugins.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://just-yt.dev',

  // `/` renders the first doc itself (src/pages/index.astro) rather than
  // bouncing through a redirect, so nobody watches a blank page hop. This entry
  // only keeps the URL that used to serve it alive.
  redirects: {
    '/docs/getting-started': '/',
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
    // Astro emits the light theme inline and the dark one as `--shiki-dark-*`
    // custom properties; global.css swaps between them on `[data-theme]`.
    shikiConfig: {
      themes: { light: codeThemeLight, dark: codeThemeDark },
      wrap: false,
    },
    processor: satteri({
      // `directive` powers `:::tabs` and the callouts; see src/lib/markdown-plugins.mjs.
      features: { directive: true },
      mdastPlugins: [docChromePlugin],
      hastPlugins: [tableScrollPlugin, docChromeHastPlugin, calloutHastPlugin],
    }),
  },

  vite: {
    server: {
      allowedHosts: ['kenobi'],
    },
  },
});
