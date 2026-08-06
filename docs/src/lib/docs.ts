import { getCollection, type CollectionEntry } from 'astro:content';

export type Doc = CollectionEntry<'docs'>;

/** Sidebar sections, in the order they should appear. */
export const GROUP_ORDER = ['Documentation', 'Explore'];

/**
 * The doc served at `/` by src/pages/index.astro rather than under `/docs/`.
 *
 * The site is documentation and nothing else, so the front page is the first
 * page — not a redirect to it. `getSortedDocs` asserts this is still the doc
 * that sorts first, because a reordering that leaves `/` pointing at page four
 * is not something anyone would notice from the sidebar.
 */
export const HOME_DOC_ID = 'getting-started';

export interface DocGroup {
  name: string;
  docs: Doc[];
}

export function docHref(doc: Doc): string {
  return doc.id === HOME_DOC_ID ? '/' : `/docs/${doc.id}`;
}

function byGroupThenOrder(a: Doc, b: Doc): number {
  const groupDelta = groupRank(a.data.group) - groupRank(b.data.group);
  if (groupDelta !== 0) return groupDelta;
  if (a.data.order !== b.data.order) return a.data.order - b.data.order;
  return a.data.title.localeCompare(b.data.title);
}

function groupRank(group: string): number {
  const index = GROUP_ORDER.indexOf(group);
  // Unknown groups sort after the known ones rather than silently jumping to the top.
  return index === -1 ? GROUP_ORDER.length : index;
}

/** Every doc in reading order — the order the pager walks through. */
export async function getSortedDocs(): Promise<Doc[]> {
  const docs = await getCollection('docs');
  docs.sort(byGroupThenOrder);

  if (docs[0]?.id !== HOME_DOC_ID) {
    throw new Error(
      `HOME_DOC_ID is "${HOME_DOC_ID}" but "${docs[0]?.id}" now sorts first. ` +
        'Update HOME_DOC_ID in src/lib/docs.ts, or restore the order, so `/` keeps serving the opening page.',
    );
  }

  return docs;
}

/** The same docs, bucketed into sidebar sections. */
export async function getDocGroups(): Promise<DocGroup[]> {
  const docs = await getSortedDocs();
  const groups: DocGroup[] = [];

  for (const doc of docs) {
    const existing = groups.find((group) => group.name === doc.data.group);
    if (existing) existing.docs.push(doc);
    else groups.push({ name: doc.data.group, docs: [doc] });
  }

  return groups;
}

/** Previous/next links for the footer pager. */
export function getPager(docs: Doc[], current: Doc) {
  const index = docs.findIndex((doc) => doc.id === current.id);
  return {
    prev: index > 0 ? docs[index - 1] : undefined,
    next: index !== -1 && index < docs.length - 1 ? docs[index + 1] : undefined,
  };
}
