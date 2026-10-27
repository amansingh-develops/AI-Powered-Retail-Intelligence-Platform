# Design System
## AI-Powered Retail Intelligence Platform — Dashboard UI

**Version:** 2.0 (revised)
**Theme:** Light, modern, elegant — built for speed, not spectacle
**Companion to:** PRD.md

---

## 0. What changed from v1, and why

The first pass reached for "premium" in the wrong register — an editorial serif hero number and a navy-and-gold enterprise palette. That's the visual language of a marketing site or a fintech landing page, not of a tool a store manager checks forty times a day, often on a modest back-office monitor in a lit shop. Navy-as-primary is also just a different cliché from the cream-and-terracotta one — it doesn't escape genericness, it swaps buckets.

This revision is grounded in what the product actually is: a **retail operations console**. The visual vocabulary comes from the domain itself — receipts, barcodes, SKU tags, POS terminals — rather than from generic "enterprise trust" signaling. Modern and elegant, here, means restraint, precision, and one confident material choice, not ornamentation.

---

## 1. Design Tokens

### 1.1 Color

One neutral system, one brand accent, one status system — kept strictly separate so nothing competes with the data.

**Neutrals**

| Token | Hex | Use |
|---|---|---|
| `--surface` | `#F6F5F2` | App background — a warm, slightly grey paper tone (closer to receipt/label stock than to a screen-white or a cream "AI default") |
| `--surface-raised` | `#FFFFFF` | Cards, panels, modals |
| `--ink-900` | `#1B1B1F` | Primary text — true graphite-black, no color tint |
| `--ink-500` | `#6B6B72` | Secondary text, metadata, timestamps |
| `--line` | `#E3E1DC` | Borders, table rules, dividers |

**Brand accent** — a single hue, used deliberately and sparingly

| Token | Hex | Use |
|---|---|---|
| `--brand` | `#3B3358` | Deep aubergine-indigo — primary actions, active nav state, focus rings, the one chart line that represents "your store" |
| `--brand-tint` | `#EDEAF2` | Selected/hover backgrounds, subtle emphasis washes |

Why this over navy: aubergine-indigo is genuinely uncommon in operations dashboards — most default to blue because it's "safe," which is exactly why it reads as generic. It's dark enough to carry authority, warm enough not to feel cold or corporate, and it sits at a clear enough distance from every status color that it never gets mistaken for a green/amber/red signal.

**Status palette** (semantic only — never used decoratively)

| Token | Hex | Meaning |
|---|---|---|
| `--status-good` | `#2E7D4F` | In stock / resolved / on target |
| `--status-warn` | `#B07A1E` | Low stock / queue building |
| `--status-bad` | `#B23A2E` | Out of stock / critical / offline |
| `--status-neutral` | `#8B8B92` | No data / unconfigured |

### 1.2 Typography

**One UI typeface, one data typeface — not a display/body split, but a functional split.**

- **UI text (labels, nav, buttons, body):** **General Sans** — a modern, slightly geometric grotesk with real character in its curves (the `a`, `g`, and `1` are distinctive) without tipping into a "display" personality that would fight the data. This carries the "elegant" register on its own; it doesn't need a serif to do that job.
- **Data & numerals (KPI values, table figures, timestamps, SKU/device IDs, prices):** **IBM Plex Mono** — grounded directly in the domain: receipts, barcodes, POS terminals, and price tags all use fixed-width numerals for a reason — alignment and unambiguous reading (no mistaking a 3 for an 8 at a glance). Using a real monospace for every number in this product is a deliberate, defensible choice, not decoration.

This two-family split does real work: the moment your eye hits a monospace string, you know without reading the label that it's a *value* — a count, a price, a timestamp, a device ID — versus UI chrome around it. That's a genuinely useful signal in a data-dense screen, not a stylistic flourish.

**Type scale**

| Role | Font | Size / Line-height | Weight |
|---|---|---|---|
| Page title | General Sans | 22px / 1.3 | 600 |
| Section heading | General Sans | 16px / 1.4 | 600 |
| Card/table label | General Sans | 13px / 1.4 | 500 |
| Body text | General Sans | 14px / 1.5 | 400 |
| KPI value | IBM Plex Mono | 32px / 1.1 | 500 |
| Table figures, IDs, timestamps | IBM Plex Mono | 13px / 1.4 | 400–500 |
| Micro label / badge text | General Sans | 12px / 1.2 | 500, sentence case |

No hero mega-number in an editorial serif. The largest thing on the Overview page is a tight stat strip — closer to a trading ticker or a departure board than a landing-page headline. That's the correct register for something checked dozens of times a day: fast, dense, no ceremony.

### 1.3 Spacing & Density

This is a genuine departure from v1: **tighter, denser, more like a professional operations tool** (Bloomberg terminal, warehouse WMS, airline ops board) than a SaaS marketing dashboard with generous air.

- Base unit: 4px.
- Table row height: 36px (compact — more rows visible without scrolling, which matters when scanning 20 SKUs or a full alert queue).
- Card padding: 16px (down from 20px) — less air, more density.
- Card gap: 12px.
- Page grid: 12-column, max width 1440px, 20px gutters.
- Left-aligned labels, right-aligned monospace figures — enables true column scanning down a table, which is the single most important reading pattern in this product.

### 1.4 Radius, Elevation, Border

- Cards/panels: 6px radius, 1px `--line` border, **no shadow** — flat is the default state everywhere on the page.
- Modals/drawers (the one floating layer — annotation tool, task detail): 10px radius, `0 6px 20px rgba(27,27,31,0.14)` — this is deliberately the *only* place a shadow appears in the entire product, so it always signals "this is temporarily on top of everything else."
- Buttons: 5px radius — slightly tighter than a rounded "friendly" SaaS button, in keeping with the terminal/console register.
- Status dots: solid circle, 6px diameter, never a filled chip/pill.

---

## 2. Status & Data Visualization

- **Never color alone.** Every status is a dot + a word: `● In stock`, `● Low stock`, `● Out of stock`, `● Offline`.
- **Alert rows:** 3px left edge color bar for severity — not a tinted row background, which would compete with reading the row's text.
- **Charts:** one line in `--brand` for the primary series; status colors appear on a chart only when the chart *is* a stock/queue-status visualization, never as arbitrary categorical decoration. No gradients, no multi-hue palettes for unrelated categories — vary weight and opacity of the single brand hue instead.
- **Heatmap overlay:** single-hue intensity scale, `--brand-tint` (quiet zones) through `--brand` (busy zones) — no rainbow/thermal-camera palette, which would look more like a weather app than an operations tool.
- **Barcode/SKU visual motif:** where it's cheap to do (device IDs, SKU tags, alert reference numbers), render them in the mono type with slightly increased letter-spacing — evokes a barcode/label reading without literally drawing barcode bars, which would be too literal.

---

## 3. Layout Concepts (key screens)

### 3.1 Overview — a stat strip, not a hero

One-sentence concept: *read like a departure board — a tight row of numbers, then straight into the alert queue and floor plan, no ceremony before the useful content.*

```
┌───────────────────────────────────────────────────────────────┐
│  [Store ▾]                                        [user] [⚙]  │
├───────────────────────────────────────────────────────────────┤
│  FOOTFALL       QUEUE WAIT      STOCK HEALTH      OPEN ALERTS   │
│  1,284           3.2 min         94%               2            │
│  (IBM Plex Mono, 32px, tight row — no hero treatment)           │
├────────────────────────────────┬─────────────────────────────────┤
│  Floor plan / heatmap           │  Live alerts                    │
│  (zone polygons, intensity)     │  ▎Low stock — Aisle 4            │
│                                  │  ▎Queue building — Counter 2      │
│                                  │  View all →                       │
├────────────────────────────────┴─────────────────────────────────┤
│  Footfall — 7 day                    Inventory health — 7 day     │
└───────────────────────────────────────────────────────────────┘
```

### 3.2 Inventory — Shelf Status Grid

Unchanged concept from v1 (this was already domain-grounded and correct): the grid mirrors the physical shelf layout from the annotation config, not an abstract table. Labels in General Sans, stock counts in mono.

```
┌───────────────────────────────────────────────────────────────┐
│  Inventory  ›  Aisle 4                     [Request snapshot]  │
├───────────────────────────────────────────────────────────────┤
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│  │ Item 1 │ │ Item 2 │ │ Item 3 │ │ Item 4 │    ● In stock       │
│  │ ● good │ │ ● warn │ │ ● bad  │ │ ● good │    ● Low stock      │
│  └────────┘ └────────┘ └────────┘ └────────┘    ● Out of stock   │
└───────────────────────────────────────────────────────────────┘
```

### 3.3 Shelf Annotation Tool

One-sentence concept: *the one screen that earns elevation — everything recedes to a dim scrim, the snapshot and the canvas are the entire world.*

```
┌───────────────────────────────────────────────────────────────┐
│  Annotate shelf — Camera 1, Aisle 4                     [✕]    │
├───────────────────────────────────────────────────────────────┤
│    [ snapshot image — draw bounding boxes on canvas ]          │
│    [ label input appears on box release ]                      │
├───────────────────────────────────────────────────────────────┤
│  Regions: Item 1, Item 2, Item 3           [Save & send to Pi] │
└───────────────────────────────────────────────────────────────┘
```

### 3.4 Queue Intelligence

One-sentence concept: *counters read like a departures board — a row of live gauges, decision-ready in under two seconds.*

```
┌───────────────────────────────────────────────────────────────┐
│  Queue — Live                                                   │
├───────────────────────────────────────────────────────────────┤
│  COUNTER 1    COUNTER 2    COUNTER 3    COUNTER 4                │
│  4 people     9 people     1 person     Closed                   │
│  ~2 min       ~6 min       ~0 min                                 │
│                                                                    │
│  ▎Recommend opening Counter 4 — projected 8 min wait in 10 min   │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. Components

- **Cards:** flat, 1px border, 6px radius, no shadow. Label in General Sans 13px/500, value in IBM Plex Mono.
- **Tables:** 36px row height, hairline dividers, no zebra striping, right-aligned mono figures, left-aligned General Sans labels.
- **Status dots:** 6px solid circle + word, never a filled pill/chip.
- **Buttons:** primary = solid `--brand`, white text, 5px radius. Secondary = white fill, `--line` border. Label states the exact action ("Save & send to Pi") — no arrow glyphs, no vague verbs like "Submit."
- **Alert row:** 3px left severity bar, single line (message, zone, mono timestamp), action right-aligned.
- **Empty states:** plain and instructive — "No alerts right now." / "No devices connected — add one in Settings." No illustration, no filler.

---

## 5. Motion

Minimal, and only in response to something happening:

- Modal/drawer open: 160ms ease-out, no bounce.
- Live value change (new alert, queue count updating): 350ms background flash in `--brand-tint`, fading out — the single consistent signal for "this just changed."
- Hover: 100ms color transition only, no scale/transform.
- No entrance animation on page load, no staggered reveals — this is a tool people return to constantly; animation on every visit is friction, not delight.
- Respects `prefers-reduced-motion`: all transitions become instant.

---

## 6. Voice & Microcopy

- Sentence case throughout, no tracked-out caps.
- Buttons name the exact action and keep that name through confirmation: "Save & send to Pi" → toast reads "Sent to Pi."
- Alerts state facts plainly: "Aisle 4 — Item 3 out of stock," not "⚠️ Attention needed!"
- No middle-dot metadata strings (`Store · Zone · 2m ago`) — separate fields or table columns instead.

---

## 7. Accessibility Floor

- Status never conveyed by color alone — always dot + label.
- `--ink-900` on `--surface`/`--surface-raised` and all status colors on white checked against WCAG AA for normal text.
- Visible keyboard focus ring: `2px solid --brand`, 2px offset, on every interactive element.
- Annotation canvas has a keyboard/list-based fallback for adding and editing regions.

---

## 8. Why This Reads as Modern and Elegant (not just "clean")

- **Elegance from restraint, not ornament** — one brand hue used sparingly, flat cards as the default, shadow reserved for exactly one elevated layer. Nothing is dressed up that doesn't need to be.
- **Modernity from a functional typographic choice** — pairing a characterful grotesk with a real monospace for every number is a system, not a font pick; it does actual work (instant "this is a value" recognition) rather than performing "considered design."
- **Density read as competence, not clutter** — tight rows and a stat-strip instead of a hero number signal "built for someone who uses this all day," which is a more sophisticated read of "premium" than whitespace and serif type would give.
- **Color pulled from the domain** (paper/receipt neutrals, an unusual ink-plum accent, disciplined status semantics) rather than from "what enterprise SaaS usually looks like" — this is the part that most makes it feel designed *for this product* rather than templated.
