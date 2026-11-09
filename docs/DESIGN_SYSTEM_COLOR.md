# Resource Vision — product colour system

The authoritative definitions live in **`src/index.css`** inside the `@theme static` block. Do not add hex literals in components, charts, or inline styles except where a dynamic value from data requires a `style` attribute (then use `var(--color-*)`).

## Tokens

| Token | Role |
| --- | --- |
| `--color-primary` | Electric Violet — primary actions, active navigation |
| `--color-ink`, `--color-ink-soft` | Primary and secondary body text |
| `--color-canvas`, `--color-surface` | App background and card surfaces |
| `--color-lavender-light`, `--color-lavender-medium`, `--color-purple-indigo`, `--color-indigo-dark` | Secondary accents and depth |
| `--color-border`, `--color-hairline` | Borders and subtle dividers |
| `--color-warning`, `--color-caution`, `--color-error`, `--color-success` | Functional / status only |
| `--color-on-inverse` | Text on saturated fills (primary buttons, status chips on dark greens, etc.) |
| `--color-on-hero`, `--color-hero-overlay*`, `--color-hero-border-subtle` | Dark app header and overlays |
| `--color-accent-surface` | Muted lavender tint for hovers, selection, avatars |

Charts (`src/lib/chart.ts`, Recharts `fill`/`stroke`) and status mapping (`src/lib/status.ts`) must reference these variables, not hex.

## Implementation rules (for contributors and agents)

1. Use the exact hexadecimal values from the product spec in `index.css` only; do not substitute similar purples in components.
2. Prefer Tailwind classes generated from the theme (`bg-primary`, `text-ink`, `border-hairline`, `bg-accent-surface`, …).
3. Reserve functional colours for meaning (badges, alerts, chart series that encode status).
4. Keep surfaces mostly neutral; use violet for emphasis and active states.
5. Pair colour with text or icons (see matrix legend, pills, and badges).
6. Do not change application logic, APIs, or data shapes for styling-only work.

For the full palette table and migration from legacy purples, refer to the product **Product Color Scheme** specification (single source of truth for hex values).
