/**
 * Vercel-style syntax themes.
 *
 * The keyword colour is the site accent, so code blocks tie into the rest of
 * the palette rather than sitting apart from it. Everything else follows the
 * Vercel reference: green strings, violet call expressions, blue properties.
 */

const DARK = {
  fg: '#ededed',
  bg: '#0a0a0a',
  keyword: '#e5326f',
  string: '#62c073',
  fn: '#b180d7',
  property: '#52a8ff',
  comment: '#7a7a7a',
  punctuation: '#8f8f8f',
};

const LIGHT = {
  fg: '#171717',
  bg: '#fafafa',
  keyword: '#c01b55',
  string: '#16794a',
  fn: '#7c3aed',
  property: '#0068d6',
  comment: '#6e6e6e',
  punctuation: '#6b6b6b',
};

/** TextMate rules are shared; only the palette differs between the two themes. */
function tokenColors(c) {
  return [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: { foreground: c.comment, fontStyle: 'italic' },
    },
    {
      scope: [
        'keyword',
        'keyword.control',
        'keyword.operator',
        'keyword.operator.new',
        'keyword.operator.expression',
        'storage',
        'storage.type',
        'storage.modifier',
        'meta.import keyword',
        'meta.export keyword',
      ],
      settings: { foreground: c.keyword },
    },
    {
      scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string'],
      settings: { foreground: c.string },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'support.constant', 'constant.character'],
      settings: { foreground: c.property },
    },
    {
      scope: [
        'entity.name.function',
        'support.function',
        'variable.function',
        'meta.function-call.method',
        'meta.function-call entity.name.function',
      ],
      settings: { foreground: c.fn },
    },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.class', 'support.type'],
      settings: { foreground: c.fg },
    },
    {
      scope: [
        'variable.other.property',
        'variable.other.object.property',
        'support.variable.property',
        'meta.object-literal.key',
        'entity.name.tag',
      ],
      settings: { foreground: c.property },
    },
    {
      scope: ['variable', 'variable.other.readwrite', 'meta.definition.variable', 'variable.parameter'],
      settings: { foreground: c.fg },
    },
    {
      scope: ['punctuation', 'punctuation.separator', 'punctuation.terminator', 'meta.delimiter'],
      settings: { foreground: c.punctuation },
    },
    {
      scope: ['punctuation.definition.block', 'punctuation.section.block', 'meta.brace.curly'],
      settings: { foreground: c.keyword },
    },
    {
      scope: ['meta.brace.round', 'meta.brace.square', 'punctuation.definition.parameters'],
      settings: { foreground: c.fn },
    },
  ];
}

function theme(name, type, c) {
  return {
    name,
    type,
    colors: { 'editor.background': c.bg, 'editor.foreground': c.fg },
    // Shiki reads `tokenColors` only when `settings` is absent, so the rules go
    // in `settings` — global default first, scoped rules after it.
    settings: [{ settings: { background: c.bg, foreground: c.fg } }, ...tokenColors(c)],
  };
}

export const codeThemeDark = theme('just-yt-dark', 'dark', DARK);
export const codeThemeLight = theme('just-yt-light', 'light', LIGHT);
