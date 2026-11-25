# Resource Vision: Colour, Type and Theme System

The single reference for how Resource Vision looks: colour tokens, status colours, typography, surfaces, elevation, controls, charts, motion, responsiveness and accessibility. It describes what is actually in the code today, not an aspiration.

**Source of truth:** every colour is defined once, in the `@theme static` block at the top of [`src/index.css`](../src/index.css). Everything else (Tailwind classes, component CSS, chart colours, status chips) references those tokens. If this document and the code disagree, the code wins; please fix the document.

> Replaces the older `DESIGN_SYSTEM_COLOR.md`, which listed tokens that no longer exist.

---

## Contents

1. [Design principles](#1-design-principles)
2. [Colour palette](#2-colour-palette)
3. [Derived tokens](#3-derived-tokens)
4. [Status colours](#4-status-colours)
5. [Typography](#5-typography)
6. [Surfaces, borders and elevation](#6-surfaces-borders-and-elevation)
7. [Spacing, radius and layout](#7-spacing-radius-and-layout)
8. [Components](#8-components)
9. [Tables](#9-tables)
10. [Charts](#10-charts)
11. [Interaction states, focus and motion](#11-interaction-states-focus-and-motion)
12. [Responsive scaling](#12-responsive-scaling)
13. [Accessibility and contrast](#13-accessibility-and-contrast)
14. [Rules for contributors](#14-rules-for-contributors)
15. [Known gaps and decisions to revisit](#15-known-gaps-and-decisions-to-revisit)
16. [Quick reference](#16-quick-reference)

---

## 1. Design principles

1. **Quiet chrome, meaningful colour.** Surfaces, borders and text are neutral. Colour is reserved for meaning: violet for the primary action and selection, and the status colours for availability.
2. **One violet.** There is a single brand accent, `#6800e0`. Do not introduce similar purples.
3. **Never colour alone.** Every status shows a letter, a label or an icon next to its colour (the matrix uses F, P, C, O, U).
4. **Numbers are tabular.** Figures use tabular lining numerals so columns of digits align.
5. **Planned, not actual.** Colours and labels never imply timesheet actuals. The product shows planned allocation.
6. **Light theme only.** There is no dark mode. The app declares no `color-scheme` and defines no dark tokens.
7. **No hex in components.** Components reference tokens (`var(--color-*)` or generated Tailwind classes) only.

---

## 2. Colour palette

Brand and functional colours. All hex values are exact and live in `index.css`.

### 2.1 Primary and neutrals

| Token | Hex | Tailwind class | Role |
|---|---|---|---|
| `--color-primary` | `#6800e0` | `bg-primary`, `text-primary` | Electric violet. Primary actions, active navigation, filter-count badges, focus ring, links |
| `--color-ink` | `#0c0c0c` | `text-ink` | Primary text: headings, values, row names |
| `--color-ink-soft` | `#242424` | `text-ink-soft` | Secondary text: body copy, labels, table cells |
| `--color-canvas` | `#f3f3f6` | `bg-canvas` | App background (behind cards), segmented-control track |
| `--color-surface` | `#ffffff` | `bg-surface` | Cards, tables, controls, popovers |
| `--color-border` | `#cccccc` | `border-border` | Hover outline on controls, neutral chart fill |

### 2.2 Violet family (secondary accents)

| Token | Hex | Role |
|---|---|---|
| `--color-purple-indigo` | `#420897` | Primary button hover; text on lavender tints (avatars, Fully Committed chip); fresher badge |
| `--color-lavender-light` | `#bc9bec` | Chart fill for Fully Committed and Program-Based; fresher badge ring |
| `--color-lavender-medium` | `#8c51e1` | Defined, currently unused |
| `--color-indigo-dark` | `#1f004c` | Deep brand shade. Only feeds the `--color-hero` alias, currently unused |

### 2.3 Functional colours (meaning only)

| Token | Hex | Used for |
|---|---|---|
| `--color-success` | `#0aa50e` | Fully Available series colour; active employee dot |
| `--color-warning` | `#ea792d` | Unverified series colour, "needs review" cues |
| `--color-error` | `#e84646` | Over-allocated series colour, error states |
| `--color-caution` | `#ffce00` | Defined, currently unused |

### 2.4 Semantic aliases

Aliases exist for readability and are not independent colours.

| Alias | Points to |
|---|---|
| `--color-text` | `--color-ink` |
| `--color-text-secondary` | `--color-ink-soft` |
| `--color-button-primary` | `--color-primary` |
| `--color-button-primary-hover` | `--color-purple-indigo` |
| `--color-divider` | `--color-border` |
| `--color-hero` | `--color-indigo-dark` |

Most usage is through the base tokens directly. The heaviest are `ink` (214 references), `surface` (114), `primary` (107), `canvas` (80), `hairline` (80) and `muted` (181).

---

## 3. Derived tokens

Built from the palette with `color-mix`, so they follow the palette if it ever changes. Resolved hex values are for reference and were computed against a white surface.

### 3.1 Text and lines

| Token | Definition | Resolved | Role |
|---|---|---|---|
| `--color-muted` | `ink-soft` 66% over `surface` | `#6e6e6e` | Third text role: meta, captions, placeholders, axis labels |
| `--color-hairline` | `ink` 6.5% over `surface` | `#efefef` | Dividers inside surfaces, table row rules |
| `--color-card-border` | `border` 72% + `ink` 9% | about `#b7b7b7` at 81% alpha | Form and control outlines |
| `--color-kpi-border`, `--color-kpi-border-hover` | `border` mixed with `ink` (38/26 and 22/34) | | Legacy KPI tile edges (2 references) |

### 3.2 Surfaces

| Token | Definition | Resolved |
|---|---|---|
| `--color-raised` | `canvas` 55% over `surface` | `#f8f8fa` (defined, unused) |
| `--color-primary-soft` | `primary` 11% over `surface` | `#eee3fc` |
| `--color-lavender-soft` | `lavender-light` 26% over `surface` | `#eee5fa` |
| `--color-success-soft` | `success` 11% over `surface` | `#e4f5e4` |
| `--color-warning-soft` | `warning` 13% over `surface` | `#fceee4` |
| `--color-error-soft` | `error` 11% over `surface` | `#fcebeb` |

### 3.3 Readable text shades on tinted surfaces

The solid functional colours are too light for small text, so text on a tint uses a darker "ink" shade.

| Token | Definition | Resolved |
|---|---|---|
| `--color-success-ink` | `success` 58% + `ink` | `#0b650d` |
| `--color-warning-ink` | `warning` 58% + `ink` | `#8d4b1f` |
| `--color-error-ink` | `error` 70% + `ink` | `#a63535` |

### 3.4 Table tokens

| Token | Definition | Resolved | Role |
|---|---|---|---|
| `--rv-table-header-bg` | `canvas` 62% over `surface` | `#f8f8f9` | Header row |
| `--rv-table-header-rule` | `card-border` | | Rule under the header |
| `--rv-table-header-ink` | `ink` 62% + `muted` | | Header text |
| `--rv-table-row-hover` | `primary` 4% over `surface` | `#f9f5fe` | Row hover wash |
| `--rv-table-stripe` | `canvas` 30% over `surface` | `#fbfbfc` | Alternate matrix rows |
| `--rv-table-current` | `primary` 5%, transparent | | Current-month column wash |
| `--rv-table-lift` | `purple-indigo` 18%, transparent | | Sticky-column lift shadow |
| `--rv-table-nested-bg` | `canvas` 45% over `surface` | `#fafafb` | Nested and child rows |

---

## 4. Status colours

Defined in [`src/lib/status.ts`](../src/lib/status.ts) as `STATUS_STYLE`. Each status has a **chip** (tinted background plus readable text) and a solid **chart** colour.

| Status | Letter | Chip background | Chip text | Chart / series | Icon |
|---|---|---|---|---|---|
| Fully Available | F | `success-soft` | `success-ink` | `success` (green) | UserRoundCheck |
| Partially Available | P | `primary-soft` | `primary` | `primary` (violet) | UserRoundPlus |
| Fully Committed | C | `lavender-soft` | `purple-indigo` | `lavender-light` | BriefcaseBusiness |
| Over-allocated | O | `error-soft` | `error-ink` | `error` (red) | TriangleAlert |
| Unverified | U | `warning-soft` | `warning-ink` | `warning` (orange) | ShieldQuestionMark |

Order everywhere (legend, charts, KPI strip): Fully Available, Partially Available, Fully Committed, Over-allocated, Unverified.

**Other states**
- **No record:** a short dash, neutral grey (`--color-border`), no tint. A month with no Project Track data at all renders blank.
- **Matrix cell:** a fixed-size "status tile" in the chip background and text colour, showing the letter and, for Partially Available, Fully Committed and Over-allocated, the remaining hours.

**Contract categories** (`CONTRACT_CHART_COLOR`)

| Category | Colour |
|---|---|
| FTE-Based | `primary` |
| Program-Based | `lavender-light` |
| Contract Not Specified | `border` (grey) |

**Project status tone** (`projectStatusTone`)

| Project status | Background | Text |
|---|---|---|
| Approval in progress (for example In Approval) | `warning-soft` | `warning-ink` |
| Active or Approved | `success-soft` | `success-ink` |
| Anything else (for example Draft) | `canvas` | `ink-soft` |

---

## 5. Typography

### 5.1 Typeface

- **Inter**, self-hosted through `@fontsource/inter` (Latin subset). Loaded weights: **400, 500, 600**. No other weights are shipped.
- Stack: `Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif` (`--font-sans`). Charts use the same stack (`CHART_FONT`).
- Body features: `font-feature-settings: "calt", "cv05", "cv08"` (contextual alternates, disambiguated l / I / 1 for codes and IDs), `font-optical-sizing: auto`, `text-rendering: optimizeLegibility`, antialiased smoothing.
- Numbers: `tabular-nums` (and `lining-nums` in KPI and table figures) in every place digits are compared.
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.

### 5.2 Type scale

Sizes are in `rem`, tuned for Inter's tall x-height. Pixel values assume the 16px root; the root itself is fluid on laptops (see [section 12](#12-responsive-scaling)).

| Token | Size | Line height | Typical use | Usages |
|---|---|---|---|---|
| `text-xs` | 0.75rem (12px) | 1rem | Labels, meta, captions, table headers, chips | 88 |
| `text-sm` | 0.8125rem (13px) | 1.25rem | **Body default**, table cells, controls | 46 |
| `text-base` | 0.875rem (14px) | 1.375rem | Emphasised body | 8 |
| `text-lg` | 0.9375rem (15px) | 1.5rem | Card titles | 4 |
| `text-xl` | 1.125rem (18px) | 1.625rem | Page and detail titles | 6 |
| `text-2xl` | 1.375rem (22px) | 1.75rem | Display figures | 1 |

Body text on `<body>` is `text-sm` at line-height 1.5.

**Small utility sizes** (kept deliberately, all in rem so they scale):

| Size | Use |
|---|---|
| 0.625rem (10px) | Tiny badges (the "Fresher" tag) |
| 0.6875rem (11px) | Group asides, table sub-labels, status-tile letters, KPI captions |
| 0.8125rem (13px) | Matrix names |
| 1rem (16px) | Form inputs on touch screens only (stops iOS zoom on focus) |

KPI figures are 1.375rem at weight 600. The floor for ordinary text is 12px; 10 and 11px are limited to badges and captions.

### 5.3 Weights

| Weight | Use | Usages |
|---|---|---|
| 400 | Body, KPI labels, secondary meta | 5 explicit |
| 500 | Labels, headers, buttons, chips, table headers, group titles | 89 |
| 600 | Page titles, KPI figures, avatars, emphasised totals | 29 |

No 700 or heavier. Hierarchy comes from size and colour first, weight second.

### 5.4 Tracking

| Token | Value | Use |
|---|---|---|
| `--tracking-heading` | -0.011em | Card and section titles |
| `--tracking-display` | -0.019em | Page titles and large figures |

Small text is never given negative tracking. Table headers use 0.

### 5.5 Text colour roles

| Role | Token | Contrast on surface | Use |
|---|---|---|---|
| Primary | `ink` | 19.6 : 1 | Titles, values, names |
| Secondary | `ink-soft` | 15.5 : 1 | Body, labels |
| Muted | `muted` | 5.1 : 1 | Meta, captions, placeholders |

---

## 6. Surfaces, borders and elevation

### 6.1 Surface layers

| Layer | Colour | Where |
|---|---|---|
| App background | `canvas` | Behind everything |
| Card / panel | `surface` with `.rv-frame` | Control deck, table cards, charts, profile |
| Inset well | `canvas` 50% over `surface` | Filters, legends (`.rv-inset-panel`) |
| Filter bar | `canvas` 42% over `surface`, hairline on top | Inside the control deck |
| Popover | `surface` with `--shadow-popover` | Dropdowns, tooltips, hover cards |
| Overlay | `ink` at 40% with a 2px blur | Dialog backdrop, mobile drawer |

### 6.2 Borders are rings, not lines

Cards use a thin shadow ring instead of a CSS border, so edges stay crisp at any zoom.

| Token | Role |
|---|---|
| `--color-edge-outer` | `ink` 10.5%: stronger ring (popovers) |
| `--color-edge-outer-soft` | `ink` 7.5%: card ring |
| `--color-edge-highlight` | White 84% over `surface`: 1px top highlight |
| `--color-edge-depth` | `ink` 4.5%: tight contact shadow |

### 6.3 Elevation

| Token | Used for |
|---|---|
| `--shadow-frame` (alias `--shadow-card`) | Cards and panels: ring, top highlight, tight shadow, soft 20px drop |
| `--shadow-control` | Buttons and selected segments |
| `--shadow-control-frame` | Form fields and secondary buttons (card-border ring) |
| `--shadow-focus` | Field focus: 3px `primary` at 16% |
| `--shadow-popover` | Dropdowns, dialogs, hover cards |
| `--shadow-kpi`, `--shadow-kpi-inset`, `--shadow-kpi-selected` | Legacy KPI tile shadows |

Shadows are neutral and soft; the only coloured shadow is the selected-state glow of `primary` at about 22 to 28%.

---

## 7. Spacing, radius and layout

- **Spacing** follows a 4px rhythm (Tailwind steps). Dashboard pages use `rv-density`, which tightens padding and gaps without dropping text below 12px.
- **Page container:** centred, max width `90rem` (1440px at 16px root). Side padding 0.75rem (phone), 1.25rem (tablet), 1.75rem (laptop and up).
- **Sidebar:** 15rem expanded, 4rem collapsed rail. Below 1024px it is always the rail; on phones it is a drawer (max width 18rem or 88vw).
- **Radius**

| Radius | Use |
|---|---|
| 0.25rem | Soft tags |
| 0.375rem | Chips, status tiles, segmented options |
| 0.5rem (`rounded-lg`) | Buttons, fields, segmented track |
| 0.625rem | Inset panels, legacy KPI tiles |
| 0.75rem (`rounded-xl`) | Cards, control deck, dialogs |
| 999px | Avatars, count badges, share bars |

Inner radius is smaller than the container's radius.

---

## 8. Components

| Component | Look |
|---|---|
| **Primary action** | Filled `primary` with white text (7.9 : 1), hover `purple-indigo` (12.3 : 1). Used sparingly |
| **Secondary button** (`.rv-btn-secondary`) | `surface`, `card-border` ring, `ink` text; hover `canvas` wash and darker `border` ring; 1px press |
| **Quiet button** | Text only in `primary`, hover `primary-soft` |
| **Field** (`.rv-field`) | `surface`, `card-border` ring; focus swaps to `--shadow-focus`; disabled `canvas` with muted text |
| **Filter pill (MultiSelect)** | Neutral field; once a value is set it gains `primary` 30% border and `primary-soft` 60% wash, plus its own clear control |
| **Count badge** | `primary` fill, white text, fully rounded |
| **Segmented control** | `canvas` track; selected option is a raised `surface` tile with `ink` text; unselected is `muted` |
| **Chip** (`.rv-chip`) | `surface`, 0.375rem radius, `ink-soft` text, weight 500 |
| **Soft tag** | `canvas` 72% over `surface`, no outline |
| **Status badge / chip** | See [section 4](#4-status-colours) |
| **Avatar** | `lavender-soft` fill, `purple-indigo` initials, faint inset ring |
| **Fresher tag** | `purple-indigo` 0.625rem text, `lavender-light` ring |
| **KPI band** | One flat `surface`, groups split by a hairline; label (`muted`, 12px), value (`ink`, 22px, 600, tabular), caption (`muted`, 11px); status chip beside status labels |
| **Share / distribution bar** | 6px high, `canvas` track, status or `primary` fills, 2px gaps |
| **Tooltip** | `surface`, popover shadow, `ink-soft` text, 400ms show delay |
| **Dialog** | `canvas` body, `surface` header and footer, hairline dividers, popover shadow |
| **Skeleton** | Shimmer between `hairline` and `canvas`, 8px radius |
| **Active nav item** | `primary-soft` 80% wash, `ink` text, 3px `primary` bar on the leading edge |
| **Sidebar rail** | `surface` with a hairline right edge and a 35% highlight |
| **Icons** | Lucide, stroke 1.75, `muted` or `ink-soft`; icons never carry their own colour except status |

---

## 9. Tables

Quiet chrome: colour lives in chips, charts and the current-month wash, not in the grid.

- **Header:** 2.5rem, background `--rv-table-header-bg`, 12px, weight 500, no tracking, bottom rule `--rv-table-header-rule`. Sort controls inherit the header ink.
- **Body rows:** 3.25rem standard, 3rem for matrices, 2.75rem for dense tables; one hairline between rows; no vertical grid lines.
- **Text** left-aligned, **numbers** right-aligned, tabular figures. Row names use `ink`; other cells `ink-soft`.
- **Hover:** `--rv-table-row-hover` (a 4% violet wash).
- **Matrix stripe:** alternate rows use `--rv-table-stripe`.
- **Sticky first column:** carries an inset hairline on its right edge and a soft lift shadow while scrolling.
- **Current month:** its column gets a 5% `primary` wash and the header a 2px `primary` rule, with the month name in `primary` at weight 600; the header cell also sets `aria-current="date"`.
- **Totals column:** quiet tinted band. **Nested rows:** `--rv-table-nested-bg`.
- **Matrix status tile:** 1.625rem high, minimum 3.25rem wide, 0.375rem radius, a 14% inset ring in the text colour.

---

## 10. Charts

Recharts, configured in [`src/lib/chart.ts`](../src/lib/chart.ts). All colours are token references.

| Element | Setting |
|---|---|
| Axis text | 11px, `muted`, Inter |
| Axis titles | 11px, weight 500, `ink-soft` |
| Grid | `hairline` dashed (3 4) |
| Hover cursor | `primary` at 5% |
| Tooltip | `surface`, 10px radius, no border, popover shadow, 12px `ink-soft` text |
| Series | Status colours for availability; contract colours for contract category |
| Gaps | Months with no Project Track data are not drawn as zero |

Charts are stacked monthly columns. Exact values always appear in tooltips and tables; the colour is never the only carrier of a number. Chart pixel sizes are set in JavaScript and do not follow the fluid root size (see [section 15](#15-known-gaps-and-decisions-to-revisit)).

---

## 11. Interaction states, focus and motion

- **Focus (keyboard):** `:focus-visible` is a 2px `primary` outline with 2px offset, everywhere. Fields use the softer `--shadow-focus` ring instead.
- **Selection** (`::selection`): `primary` 22% over `surface`, `ink` text.
- **Hover:** quiet and inside the palette: wash to `canvas`, outline to `border`, or the 4% violet row wash. No colour changes to the brand violet itself except the primary button.
- **Disabled:** `canvas` fill, `muted` text, `not-allowed` cursor.
- **Scrollbars:** thin, neutral (`muted` at 38 to 50%), transparent track.
- **Transitions:** 150ms ease on colour, background, border and shadow. Tooltip, pop, reveal and fade run 120 to 180ms; dialog sheets (200ms) and the drawer (220ms) use `--ease-out-quart` (`cubic-bezier(0.25, 1, 0.5, 1)`). Tooltips appear after 400ms and hide after 80ms. The skeleton shimmer loops every 1.4s.
- **Reduced motion:** with `prefers-reduced-motion: reduce`, animations and transitions drop to 0.01ms.

---

## 12. Responsive scaling

Every size in the app is in `rem`, so one root font size scales the whole interface.

| Viewport | Root font size |
|---|---|
| Phones, tablets, touch screens (`pointer: coarse`) | 16px |
| Mouse-driven, below 1024px wide | 16px |
| Mouse-driven, 1024px and wider | Fluid, 14px to 16px: `min( clamp(14px, 14px + 2 x (width - 1280) / 256, 16px), clamp(14px, 14px + 2 x (height - 600) / 140, 16px) )` |

Examples of the browser-viewport size and the resulting root:

| Viewport (CSS px) | Root |
|---|---|
| 1536 x 740 (15.6" at 125%) | 16px |
| 1440 x 700 | 15.25px |
| 1366 x 650 | 14.7px |
| 1280 x 600 (14" at 150%) | 14px |

**Breakpoints** (`md` is customised)

| Name | Width | Notes |
|---|---|---|
| `md` | 44rem (704px) | So portrait iPad mini gets the tablet layout |
| `lg` | 64rem (1024px) | Side-by-side charts and tables begin here |
| `xl` | 80rem (1280px) | Wider spacing only |

**Custom variants:** `touch` (coarse pointer: 40px targets, 16px inputs), `short` (height up to 480px, landscape phones) and `compact-height` (height up to 52rem).

---

## 13. Accessibility and contrast

WCAG ratios computed from the actual values.

**Text pairs (all meet 4.5 : 1 unless noted)**

| Pair | Ratio |
|---|---|
| `ink` on `surface` / `canvas` | 19.6 / 17.7 |
| `ink-soft` on `surface` / `canvas` | 15.5 / 14.0 |
| `muted` on `surface` | 5.1 |
| `muted` on `canvas` | 4.6 |
| `primary` on `surface` / `canvas` | 7.9 / 7.1 |
| White on `primary` | 7.9 |
| White on `purple-indigo` (hover) | 12.3 |
| `primary` on `primary-soft` | 6.4 |
| `purple-indigo` on `lavender-soft` | 10.1 |
| `success-ink` on `success-soft` | 6.4 |
| `warning-ink` on `warning-soft` | 5.9 |
| `error-ink` on `error-soft` | 5.7 |

**Solid colours (graphics and fills only, never small text)**

| Colour on `surface` | Ratio | Note |
|---|---|---|
| `error` | 3.9 | Meets the 3 : 1 graphics guideline |
| `success` | 3.3 | Meets 3 : 1 |
| `warning` | 2.9 | Slightly under 3 : 1; always labelled |
| `lavender-light` | 2.3 | Under 3 : 1; always labelled |
| `border` | 1.6 | Decorative and "no value" fills only |

Because several chart fills sit under 3 : 1, every chart has a legend, tooltips and a table with the same values, and every matrix cell carries a letter. Colour is never the only signal.

Other practices:
- Visible keyboard focus on every interactive element.
- Icons beside status labels are `aria-hidden`; the label carries the meaning.
- Minimum 40px touch targets on coarse pointers.
- Reduced-motion support.

---

## 14. Rules for contributors

1. **Add or change a colour only in the `@theme static` block of `src/index.css`.** Never put a hex value, `rgb()` or `hsl()` in a component, chart or inline style. (The code is currently clean of literals: components contain none.)
2. **Use theme classes** (`bg-primary`, `text-ink`, `border-hairline`, `bg-primary-soft`, and so on). Use `var(--color-*)` only for values built in JavaScript.
3. **Do not use Tailwind's default palette** (`bg-gray-100`, `text-red-500`). Only `text-purple-indigo` and the theme names are used.
4. **Functional colours are for meaning.** Do not use green, orange or red for decoration.
5. **Text on a tint uses the `*-ink` shade**, never the solid functional colour.
6. **Pair colour with a label, letter or icon.**
7. **Keep sizes in `rem`.** A fixed pixel size will not follow the laptop scaling in section 12.
8. **Use weights 400, 500 and 600 only**, and keep numbers tabular.
9. **Keep Inter and the existing colour scheme** unless the product owner approves a change.
10. **No dash punctuation** in user-facing copy (a style rule of this product).
11. After any theme change, run `tsc`, lint and build, and re-check contrast for new text pairs.

**Adding a new status or tag colour**
1. Reuse an existing token if the meaning fits.
2. If a new tint is required, add the solid, `-soft` and `-ink` triplet to `@theme` and check the `-ink` on `-soft` pair reaches 4.5 : 1.
3. Register it in `src/lib/status.ts` so the chip, chart and legend share it.

---

## 15. Known gaps and decisions to revisit

Recorded honestly so they are not rediscovered later.

| Item | Detail | Suggested action |
|---|---|---|
| Unused tokens | `--color-lavender-medium`, `--color-caution`, `--color-indigo-dark` (and `--color-hero`), `--color-raised`, `--color-text` aliases, `--color-divider` are defined with no or almost no use | Keep for brand completeness or remove |
| Legacy KPI tokens | `--color-kpi-border*` and `--shadow-kpi*` support the old KPI card, now replaced by the KPI band | Remove if the old card is no longer used |
| Comment drift | The comment on `--color-muted` says 4.7 : 1 on canvas; the computed value is 4.6 : 1 (still above 4.5) | Correct the comment |
| Browser theme colour | `index.html` sets `theme-color` to `#f6f6f6`, which is not the canvas (`#f3f3f6`) | Align it to the canvas |
| Under-3 : 1 fills | `warning` (2.9) and `lavender-light` (2.3) as chart fills | Acceptable while labelled; revisit if a chart ever drops its legend |
| No dark theme | Light only, by design | Would need a full second token set and `color-scheme` |
| Chart pixel sizes | Chart fonts (11px, 12px) and some heights are fixed in JavaScript, so they do not follow the fluid root | Scale them with the `remPx` helper if needed |
| Pixel hairlines | A few 1px, 2px and 3px values (rings, rules) are fixed on purpose | None; these should stay crisp |
| Favicon | `c5i-glyph.png` is the brand glyph and is not part of this system | None |

---

## 16. Quick reference

```
Brand        primary #6800e0     purple-indigo #420897     lavender-light #bc9bec
Neutrals     ink #0c0c0c   ink-soft #242424   muted #6e6e6e   hairline #efefef
             canvas #f3f3f6   surface #ffffff   border #cccccc
Functional   success #0aa50e   warning #ea792d   error #e84646
Tints        primary-soft #eee3fc  lavender-soft #eee5fa  success-soft #e4f5e4
             warning-soft #fceee4  error-soft #fcebeb
Ink shades   success-ink #0b650d   warning-ink #8d4b1f   error-ink #a63535

Status       F success   P primary   C lavender-light   O error   U warning
Font         Inter 400 / 500 / 600, self-hosted Latin
Scale        12 / 13 (body) / 14 / 15 / 18 / 22 px at a 16px root
Root         16px, fluid 14 to 16px on laptops
Focus        2px primary outline, 2px offset
Breakpoints  md 704px   lg 1024px   xl 1280px
```
