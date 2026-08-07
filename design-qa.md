# Design QA

## Evidence

- Source visual truth: `conversation://user-reference/sidebar-navigation` and
  `conversation://user-reference/copy-page-menu`, plus the active-rail, rounded
  search, and landing onramp references in the follow-up request.
- Browser-rendered implementation:
  `design-qa-artifacts/docs-page-menu.png`.
- Focused implementation evidence:
  `design-qa-artifacts/sidebar-focus.png` and
  `design-qa-artifacts/markdown-menu-focus.png`.
- Follow-up implementation evidence:
  `design-qa-artifacts/sidebar-active-rail.png`,
  `design-qa-artifacts/landing-onramp-for-you.png`, and
  `design-qa-artifacts/landing-onramp-for-agent.png`.
- Source pixels: sidebar reference `292 × 937`; menu reference `323 × 284`.
- Implementation pixels: full view `1920 × 873`; sidebar focus `344 × 873`;
  menu focus `310 × 190`.
- CSS viewport: `1920 × 873`; desktop browser capture at 1× CSS scale.
- State: dark theme, Search page active, all navigation chapters expanded,
  Copy page menu open.

The references are focused component crops rather than a complete page at the
same viewport. The comparison therefore uses the focused implementation crops
for density, hierarchy, spacing, surface treatment, and open-state fidelity;
it does not treat the intentional sidebar width difference as drift.

## Full-view comparison

The full page preserves the existing just-yt layout while placing the compact
Copy page control at the right edge of the title row. The open menu aligns to
the trigger, stays inside the content column, and does not change the article
or table-of-contents geometry. The sidebar remains visually separate through
spacing rather than a background panel or border.

## Focused comparison

- Sidebar: section headings, chevrons, link weight, and vertical density match
  the reference direction. Each group now has a quiet vertical rail, with the
  active row marked by a white segment and text instead of a filled, bordered
  pill. One-word labels reduce wrapping and scanning time. The scrollbar is
  absent at rest, appears at the right edge while the sidebar scrolls, tracks
  scroll progress, and fades after 700 ms.
- Page menu: trigger, rounded dark surface, compact two-line rows, bordered
  icons, descriptions, and external-link cue match the supplied menu language.
  Only the two requested actions are included.
- Landing onramp: the centered `For you` / `For your agent` tabs, separator,
  command pill, and prompt button match the supplied compact hierarchy without
  introducing another panel style. The former hero CTAs now appear only in the
  final landing section.

## Required fidelity surfaces

- Fonts and typography: existing Inter and JetBrains Mono families are
  preserved. Sidebar links use the same optical size and weight as the source;
  menu labels and descriptions have distinct, readable hierarchy.
- Spacing and layout rhythm: sidebar links measure about 32 px high, down from
  about 36 px. Section transitions remain larger than link-to-link spacing.
  Menu rows and trigger align without shifting the title or lead.
- Colors and visual tokens: the implementation reuses the established black,
  raised-surface, muted-text, and hairline tokens. No new competing accent color
  was introduced.
- Shape: shared radii are increased by 2 px, giving search and standard controls
  a slightly softer, consistent silhouette while preserving pill controls.
- Image quality and asset fidelity: neither reference contains raster imagery.
  Interface icons use the project's existing monoline icon system and remain
  sharp at the rendered size.
- Copy and content: sidebar names are one word. Menu copy is exactly scoped to
  copying Markdown and viewing the page as Markdown.

## Interaction and diagnostics

- Tested menu open/close behavior.
- Tested Copy page success feedback.
- Tested View as Markdown opening `/docs/search.md` in a new tab.
- Confirmed `/docs/search.md` and `/index.md` return real Markdown with
  `text/markdown; charset=utf-8`.
- Tested transient sidebar scroll indicator position and idle fade.
- Confirmed the landing page has no Copy page menu and renders five feature
  sections from `src/content/landing/index.md`.
- Tested both landing onramp tabs, keyboard-compatible tab state, the prompt
  copy success state, and the domain-derived `/start.md` prompt URL.
- Confirmed `/start.md` is emitted verbatim and links only to the focused setup,
  feature, configuration, reliability, and Effect guides needed by an agent.
- Confirmed the active docs link has a transparent background, no shadow, and a
  white rail segment; the search control resolves to a 12 px radius and keeps
  the existing Command-K hint.
- Browser console warnings/errors: none.

## Findings

No actionable P0, P1, or P2 differences remain. The references are directional
component examples, and the implementation matches their requested density,
behavior, hierarchy, and surface treatment within the existing design system.

## Comparison history

- Pass 1: the Markdown action used a typographic `M↓` mark. Replaced it with a
  file-text icon from the existing monoline icon system, then recaptured the
  focused menu. Post-fix evidence:
  `design-qa-artifacts/markdown-menu-focus.png`.
- Pass 2: no actionable P0/P1/P2 findings.

## Follow-up polish

No P3 items are required for this scope.

final result: passed
