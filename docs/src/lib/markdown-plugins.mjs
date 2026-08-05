/**
 * Wraps every markdown table in `<div class="table-scroll">`.
 *
 * Tables are the one block that can't reflow on a narrow screen, and the
 * alternative — `display: block` on the table itself — throws away column
 * sizing. Written as a Sätteri hast plugin so it runs on Astro's default
 * Markdown processor rather than pulling the legacy unified pipeline back in.
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
