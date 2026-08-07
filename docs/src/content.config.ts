import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const sidebarName = z
  .string()
  .refine((value) => value.trim().split(/\s+/).length <= 3, 'Sidebar names must use no more than three words.')
  .refine(
    (value) => value.trim().split(/\s+/).every((word) => word[0] === word[0]?.toUpperCase()),
    'Every word in a sidebar name must start with a capital letter.',
  );

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    /** Page `<h1>`, pager label and `<title>`. */
    title: z.string(),
    /** Optional compact sidebar name. Prefer one word. */
    label: sidebarName.optional(),
    /** Lead paragraph and meta description. One sentence. */
    description: z.string(),
    /** Sidebar section this page belongs to. See GROUP_ORDER in src/lib/docs.ts. */
    group: sidebarName.default('Start Here'),
    /** Position within the group. Lower sorts first. */
    order: z.number().default(99),
  }),
});

const landing = defineCollection({
  loader: glob({ pattern: 'index.md', base: './src/content/landing' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
  }),
});

export const collections = { docs, landing };
