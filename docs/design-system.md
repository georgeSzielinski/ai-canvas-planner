# Design system

The visual system is extracted from the retained Claude Design export. Light mode is the default.

## Tokens

| Role | Light | Dark |
|---|---|---|
| Background | `#f4f6f9` | `#080d18` |
| Panel | `#ffffff` | `#101827` |
| Secondary panel | `#f1f4f8` | `#151e30` |
| Border | `#e6e9ef` | `#1e293b` |
| Primary text | `#0e1626` | `#eef2f8` |
| Secondary text | `#586074` | `#98a4b6` |
| Accent | `#1d4ed8` | `#60a5fa` |
| Focus ring | blue, 42% | light blue, 50% |

Semantic colors are red (urgent/error), orange (high pressure), amber (warning/demo), green (ready/success), blue (study/Canvai), and slate (fixed events). Course colors remain purple AP Seminar, rose English, teal Precalculus, sky Physics, ochre Business, and indigo World History, with lighter dark-mode variants.

The source prototype used `#3b82f6` as its universal accent and lighter tertiary text. The production light accent, light status colors, and tertiary text are slightly deeper, while dark-mode accent and tertiary text are slightly brighter, so small labels and controls meet automated contrast checks. Hue, hierarchy, and visual identity are unchanged.

## Shape, depth, and spacing

- Radii: 8, 10, 14, and 16px; pills use a full radius.
- Shadows: subtle two-layer card shadow and restrained large overlay shadow.
- Spacing follows a compact 4px-derived rhythm, with 14–20px card padding and 20px page gaps.
- Borders carry most hierarchy; shadows never replace structure.
- Desktop sidebar is 264px. Content caps at 1280px; landing content caps at 1140px.

## Typography and icons

Geist Sans is the interface face and Geist Mono is reserved for times, scores, and compact numeric labels. Headings use tight tracking and 650–720 weights. Phosphor icons are normally 16–20px with filled icons limited to active navigation, Canvai, and key states.

## Motion and focus

Transitions run roughly 150–250ms on the prototype’s `cubic-bezier(.2,.7,.2,1)` curve. Page entry, drawer, modal, toast, skeleton, analysis, and switch motion are restrained. `prefers-reduced-motion` collapses all timing. Every interactive control receives the shared visible focus ring.

## Breakpoints

- Above 1100px: full desktop composition.
- 901–1100px: compact grids.
- 641–900px: sidebar becomes a sheet and major layouts stack.
- 640px and below: touch-first bottom navigation, sheet-style modals, stacked forms, compact charts, and assignment detail overlay.
