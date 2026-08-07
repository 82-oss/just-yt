import { getCollection, type CollectionEntry } from 'astro:content';

export type Doc = CollectionEntry<'docs'>;

/** Sidebar sections, in the order they should appear. */
export const GROUP_ORDER = ['Start Here', 'Core Concepts', 'Features', 'Configuration', 'Advanced', 'Reference'];

export interface DocGroup {
  name: string;
  docs: Doc[];
}

/** Every doc lives under `/docs/`; `/` is the landing page, not a doc. */
export function docHref(doc: Doc): string {
  return `/docs/${doc.id}`;
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
  return docs;
}

/**
 * Where "Get started" on the landing page points: the first doc in reading
 * order. Derived rather than hard-coded, so reordering the collection moves the
 * entry point with it instead of leaving the button on page four.
 */
export async function getDocsEntryHref(): Promise<string> {
  const [first] = await getSortedDocs();
  if (!first) throw new Error('The docs collection is empty — there is nothing for `/` to link to.');
  return docHref(first);
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

/**
 * Landing header/footer shortcuts into the main doc groups. Each href is the
 * first page of that group in reading order, so reordering the collection keeps
 * the chrome pointing at a real entry point instead of a stale hard-coded slug.
 */
export async function getLandingNavLinks(): Promise<{ label: string; href: string }[]> {
  const groups = await getDocGroups();

  const firstOf = (name: string): string => {
    const group = groups.find((candidate) => candidate.name === name);
    const first = group?.docs[0];
    if (!first) throw new Error(`Docs group "${name}" is empty or missing.`);
    return docHref(first);
  };

  return [
    { label: 'Start here', href: firstOf('Start Here') },
    { label: 'Features', href: firstOf('Features') },
    { label: 'Configuration', href: firstOf('Configuration') },
    { label: 'API reference', href: firstOf('Reference') },
  ];
}
