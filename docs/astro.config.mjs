// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { codeThemeDark, codeThemeLight } from './src/lib/code-theme.mjs';
import { tableScrollPlugin } from './src/lib/markdown-plugins.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://just-yt.dev',

  // The overview page is gone; the docs carry the introduction now.
  redirects: {
    '/': '/docs/getting-started',
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
    processor: satteri({ hastPlugins: [tableScrollPlugin] }),
  },

  vite: {
    server: {
      allowedHosts: ['kenobi'],
    },
  },
});
