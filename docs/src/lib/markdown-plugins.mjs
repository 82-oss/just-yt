/**
 * Sätteri plugins for the docs pipeline.
 *
 * These run on Astro's default Markdown processor rather than pulling the
 * legacy unified pipeline back in, which is why the chrome below is assembled
 * from hast nodes and raw HTML instead of components: `.md` files can't import
 * Astro components, and the alternative — moving the whole collection to MDX —
 * costs more than it buys for five pages.
 *
 * Split across two phases on purpose:
 *
 *   mdast  — where authored intent still exists (a fence's `title=` meta, a
 *            `:::note` directive) but nothing has been highlighted yet.
 *   hast   — where the surrounding chrome is injected, after Shiki has replaced
 *            each `<pre>`.
 *
 * Nothing here reads the highlighted code itself; the copy button picks the
 * text off the DOM at runtime, so it can't fall out of step with Shiki.
 */

/* ------------------------------------------------------------- helpers --- */

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

/** `title="src/index.ts" foo` → `{ title: 'src/index.ts' }`. */
function parseMeta(meta) {
  const parsed = {};
  if (!meta) return parsed;
  for (const [, key, quoted, bare] of meta.matchAll(/(\w[\w-]*)=(?:"([^"]*)"|(\S+))/g)) {
    parsed[key] = quoted ?? bare;
  }
  return parsed;
}

const raw = (value) => ({ type: 'raw', value });

/**
 * A 24×24 monoline glyph, matching src/components/Icon.astro.
 *
 * Kept as a separate copy rather than shared: the component is an `.astro` file
 * that only Astro's compiler can read, and this module is loaded by the Markdown
 * processor at config time. Only the callout glyphs are duplicated.
 */
const icon = (paths, extraClass = '') =>
  `<svg class="icon${extraClass && ` ${extraClass}`}" viewBox="0 0 24 24" width="16" height="16" fill="none" ` +
  `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const GLYPH = {
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11.2v5"/><path d="M12 7.9h.01"/>',
  lightbulb:
    '<path d="M9.2 17.4a6 6 0 1 1 5.6 0v1.4a1.6 1.6 0 0 1-1.6 1.6h-2.4a1.6 1.6 0 0 1-1.6-1.6v-1.4Z"/><path d="M9.4 17.4h5.2"/>',
  alert: '<path d="M12 3.8 2.7 19.2h18.6L12 3.8Z"/><path d="M12 10v3.6"/><path d="M12 16.6h.01"/>',
  octagon:
    '<path d="M8.6 3.3h6.8l4.8 4.8v6.8l-4.8 4.8H8.6l-4.8-4.8V8.1l4.8-4.8Z"/><path d="M12 8v4.6"/><path d="M12 16.2h.01"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2.6"/><path d="M15 5.6A2.6 2.6 0 0 0 12.4 4H6.6A2.6 2.6 0 0 0 4 6.6v5.8A2.6 2.6 0 0 0 5.6 15"/>',
  check: '<path d="m4.5 12.6 4.8 4.7L19.5 6.8"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="3.2"/><path d="m10 8.8 5.4 3.2-5.4 3.2Z"/>',
  transcript:
    '<path d="M6 3.5h8l4 4v13H6Z"/><path d="M14 3.5v4h4"/><path d="M9 11.5h6"/><path d="M9 15h6"/><path d="M9 18.5h3.5"/>',
  channel:
    '<circle cx="9" cy="8.5" r="3"/><path d="M3.8 19a5.2 4.8 0 0 1 10.4 0"/><path d="M15.5 7a2.6 2.6 0 0 1 0 5"/><path d="M16.2 15.2a4.5 4.5 0 0 1 4 3.8"/>',
};

/* ------------------------------------------------------------ callouts --- */

/**
 * Callout kinds, keyed by directive name. Aliases exist because nobody
 * remembers whether the scary one is "warning" or "caution".
 */
const CALLOUTS = {
  note: { tone: 'note', glyph: 'info', title: 'Note' },
  info: { tone: 'note', glyph: 'info', title: 'Note' },
  tip: { tone: 'tip', glyph: 'lightbulb', title: 'Tip' },
  warning: { tone: 'warning', glyph: 'alert', title: 'Warning' },
  caution: { tone: 'warning', glyph: 'alert', title: 'Caution' },
  danger: { tone: 'danger', glyph: 'octagon', title: 'Danger' },
};

function setLinkCard(node, ctx) {
  const { description, href, icon: glyph = 'info', title } = node.attributes ?? {};

  if (!href || !title || !description) {
    ctx.report({
      message: 'A `::link-card` needs `href`, `title`, and `description` attributes.',
      node,
      severity: 'warning',
    });
  }

  ctx.setProperty(node, 'data', {
    hName: 'a',
    hProperties: {
      class: 'doc-card',
      href: href ?? '#',
      'data-doc-card': '',
      'data-doc-card-description': description ?? '',
      'data-doc-card-icon': glyph,
      'data-doc-card-title': title ?? 'Documentation',
    },
  });
}

/* ---------------------------------------------------------------- mdast --- */

/**
 * Turns authored syntax into marked-up containers the hast pass can finish.
 *
 * - ```` ```ts title="src/x.ts" ```` → a `<figure>` carrying the caption.
 * - `:::tabs` around a run of fences → one tabbed group, labelled by each
 *   fence's `title=`. Only fences belong inside; anything else is reported.
 * - `:::note` / `:::tip` / `:::warning` / `:::danger` → a callout, with an
 *   optional `{title="…"}` overriding the default heading.
 * - A plain `>` blockquote → an untitled note callout. These docs use
 *   blockquotes as asides, never as quotations.
 */
export const docChromePlugin = {
  name: 'doc-chrome',

  containerDirective(node, ctx) {
    if (node.name === 'link-grid') {
      ctx.setProperty(node, 'data', {
        hName: 'div',
        hProperties: { class: 'doc-card-grid' },
      });
      return;
    }

    if (node.name === 'link-card') {
      setLinkCard(node, ctx);
      return;
    }

    if (['landing-hero', 'landing-feature', 'landing-closing'].includes(node.name)) {
      ctx.setProperty(node, 'data', {
        hName: 'section',
        hProperties: { class: node.name },
      });
      return;
    }

    if (node.name === 'tabs') {
      const labels = node.children.map((child, index) =>
        child.type === 'code' ? (parseMeta(child.meta).title ?? child.lang ?? `Tab ${index + 1}`) : '',
      );

      if (node.children.some((child) => child.type !== 'code')) {
        ctx.report({
          message: 'A `:::tabs` block should contain only fenced code blocks.',
          node,
          severity: 'warning',
        });
      }

      ctx.setProperty(node, 'data', {
        hName: 'div',
        // JSON rather than a delimited string: labels are author-written, and
        // there is no separator a runtime or package-manager name can't contain.
        hProperties: { class: 'code-tabs', 'data-code-tabs': '', 'data-tab-labels': JSON.stringify(labels) },
      });
      return;
    }

    const callout = CALLOUTS[node.name];
    if (!callout) {
      ctx.report({
        message: `Unknown directive \`:::${node.name}\`. Expected one of: tabs, ${Object.keys(CALLOUTS).join(', ')}.`,
        node,
        severity: 'warning',
      });
      return;
    }

    // `null` means the attribute was written bare (`{title}`), which reads as
    // "give me the default", not "give me an empty heading".
    const title = node.attributes?.title ?? callout.title;

    ctx.setProperty(node, 'data', {
      hName: 'aside',
      hProperties: {
        class: 'callout',
        'data-callout': callout.tone,
        'data-callout-glyph': callout.glyph,
        ...(title ? { 'data-callout-title': title } : {}),
      },
    });
  },

  leafDirective(node, ctx) {
    if (node.name === 'link-card') setLinkCard(node, ctx);
  },

  blockquote(node, ctx) {
    ctx.setProperty(node, 'data', {
      hName: 'aside',
      hProperties: { class: 'callout', 'data-callout': 'note', 'data-callout-glyph': 'info' },
    });
  },

  code(node, ctx) {
    const { title } = parseMeta(node.meta);
    const parent = ctx.parent(node);
    const inTabs = parent?.type === 'containerDirective' && parent.name === 'tabs';

    ctx.wrapNode(node, {
      type: 'containerDirective',
      name: 'code-card',
      children: [],
      data: {
        hName: 'figure',
        hProperties: {
          class: 'code-card',
          'data-code-card': '',
          ...(node.lang ? { 'data-code-language': node.lang } : {}),
          // Inside a group the fence's title becomes the tab label instead, so
          // rendering it again as a caption would just repeat it.
          ...(title && !inTabs ? { 'data-code-title': title } : {}),
          ...(inTabs ? { 'data-tab-index': String(ctx.indexOf(node) ?? 0) } : {}),
        },
      },
    });
  },
};

/* ----------------------------------------------------------------- hast --- */

/**
 * Wraps every markdown table in `<div class="table-scroll">`.
 *
 * Tables are the one block that can't reflow on a narrow screen, and the
 * alternative — `display: block` on the table itself — throws away column
 * sizing.
 */
export const tableScrollPlugin = {
  name: 'table-scroll-wrapper',
  element: {
    filter: ['table'],
    visit(node, ctx) {
      ctx.wrapNode(node, {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-scroll'] },
        children: [],
      });
    },
  },
};

/** Adds the icon and visible title to Markdown-authored documentation cards. */
export const docCardsHastPlugin = {
  name: 'doc-cards',
  element: {
    filter: ['a'],
    visit(node, ctx) {
      if (!('data-doc-card' in (node.properties ?? {}))) return;

      const glyph = String(node.properties['data-doc-card-icon'] ?? 'info');
      const title = String(node.properties['data-doc-card-title'] ?? 'Documentation');
      const description = String(node.properties['data-doc-card-description'] ?? '');
      ctx.prependChild(
        node,
        raw(
          `<span class="doc-card-icon">${icon(GLYPH[glyph] ?? GLYPH.info, 'doc-card-glyph')}</span>` +
            `<strong class="doc-card-title">${escapeHtml(title)}</strong>` +
            `<span class="doc-card-description">${escapeHtml(description)}</span>`,
        ),
      );
    },
  },
};

const copyButton =
  '<button class="code-copy" type="button" data-code-copy aria-label="Copy code to clipboard">' +
  `${icon(GLYPH.copy, 'copy-idle')}${icon(GLYPH.check, 'copy-done')}` +
  '<span class="code-copy-tip" data-code-copy-tip aria-hidden="true">Copy</span>' +
  '</button>';

/**
 * Finishes the containers `docChromePlugin` marked up.
 *
 * A factory rather than a plain object so the tab-group counter — which only
 * has to be unique within one rendered page — resets for every document.
 */
export const docChromeHastPlugin = () => {
  let groupId = 0;

  return {
    name: 'doc-chrome-hast',

    element: [
      {
        filter: ['figure'],
        visit(node, ctx) {
          if (!('data-code-card' in (node.properties ?? {}))) return;

          const title = node.properties['data-code-title'];
          if (title) ctx.prependChild(node, raw(`<figcaption class="code-card-title">${escapeHtml(title)}</figcaption>`));

          // Last child so it paints over the scroll container without needing a
          // stacking context on the `<pre>` itself.
          ctx.appendChild(node, raw(copyButton));
        },
      },

      {
        filter: ['div'],
        visit(node, ctx) {
          const labels = node.properties?.['data-tab-labels'];
          if (labels === undefined) return;

          const id = `tabs-${groupId++}`;
          const tabs = JSON.parse(String(labels))
            .map((label, index) => {
              const selected = index === 0;
              return (
                `<button class="code-tab" type="button" role="tab" id="${id}-tab-${index}" ` +
                `aria-controls="${id}-panel-${index}" aria-selected="${selected}" ` +
                `tabindex="${selected ? 0 : -1}" data-tab-index="${index}">${escapeHtml(label)}</button>`
              );
            })
            .join('');

          ctx.prependChild(
            node,
            raw(`<div class="code-tabs-list" role="tablist" aria-label="Alternatives">${tabs}</div>`),
          );

          // Panels are addressed by index rather than by DOM order so the
          // tablist stays correct even if a stray block sneaks into the group.
          for (const child of node.children) {
            const index = child.properties?.['data-tab-index'];
            if (index === undefined) continue;

            ctx.setProperty(child, 'id', `${id}-panel-${index}`);
            ctx.setProperty(child, 'role', 'tabpanel');
            ctx.setProperty(child, 'aria-labelledby', `${id}-tab-${index}`);

            // The first panel is marked at build time so the group still shows
            // something useful before (or without) JavaScript.
            if (index === '0') ctx.setProperty(child, 'data-tab-active', '');
            else ctx.setProperty(child, 'hidden', true);
          }
        },
      },
    ],
  };
};

/**
 * Prepends the tone glyph, and the heading when the callout has one.
 *
 * Both go in as one raw node: two `prependChild` calls are queued against the
 * same index and land in the order they were recorded, which is the reverse of
 * what reads naturally here.
 *
 * The callout lays itself out as a two-column grid rather than wrapping the
 * body in a div — there is no "wrap all children" primitive, and the grid does
 * the same job in CSS.
 */
export const calloutHastPlugin = {
  name: 'callout-chrome',
  element: {
    filter: ['aside'],
    visit(node, ctx) {
      const glyph = node.properties?.['data-callout-glyph'];
      if (!glyph) return;

      const title = node.properties['data-callout-title'];

      ctx.prependChild(
        node,
        raw(
          `<span class="callout-icon">${icon(GLYPH[glyph] ?? GLYPH.info)}</span>` +
            (title ? `<p class="callout-title">${escapeHtml(title)}</p>` : ''),
        ),
      );
    },
  },
};
