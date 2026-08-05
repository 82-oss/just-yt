import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    /** Page `<h1>`, sidebar label, pager label and `<title>`. Keep it short. */
    title: z.string(),
    /** Lead paragraph and meta description. One sentence. */
    description: z.string(),
    /** Sidebar section this page belongs to. See GROUP_ORDER in src/lib/docs.ts. */
    group: z.string().default('Documentation'),
    /** Position within the group. Lower sorts first. */
    order: z.number().default(99),
  }),
});

export const collections = { docs };
