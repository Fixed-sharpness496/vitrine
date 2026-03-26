# Frontend

Next.js 15 app deployed on Vercel. Tailwind v4 for styling, Recharts for charts, no external state management library.

## Pages

| Route | Component | Render |
|---|---|---|
| `/` | Search | Client |
| `/clusters` | Collections list | Client |
| `/clusters/[id]` | Collection detail | Server |
| `/intent` | Conseil d'achat | Client |
| `/analytics` | Tableau de bord | Client |
| `/quality` | Rapport qualité | Server |

---

## File structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout: Nav + OnboardingGuide + Footer
│   ├── globals.css             # CSS variables, base styles, animations
│   ├── page.tsx                # / — semantic search
│   ├── clusters/
│   │   ├── page.tsx            # /clusters — paginated list + filter
│   │   └── [id]/page.tsx       # /clusters/:id — product table
│   ├── intent/page.tsx         # /intent — buyer brief RAG
│   ├── analytics/page.tsx      # /analytics — 6 Recharts
│   └── quality/page.tsx        # /quality — data quality KPIs
├── components/
│   ├── Nav.tsx                 # Sticky nav, responsive (hamburger on mobile)
│   ├── Footer.tsx              # Stack info
│   └── OnboardingGuide.tsx     # First-visit 5-step modal
└── lib/
    └── api.ts                  # API client + price parser
```

---

## Key files

### `lib/api.ts`

Single fetch wrapper with error handling. Exports one function per endpoint plus `parsePriceConstraints`.

**Price parsing** — extracts `max_price` / `min_price` from natural language before calling `/search`:

```
"jean slim moins de 80$"  →  { max_price: 80 }
"entre 20 et 100$"        →  { min_price: 20, max_price: 100 }
"plus de 30$"             →  { min_price: 30 }
```

Patterns cover French and English, with `$`, `€`, `£` symbols.

### `globals.css`

Design tokens in CSS variables (`--bg`, `--text`, `--accent`, `--border`, etc.). Tailwind v4 with `@source` directive pointing to all `.tsx` files to fix class scanning on Vercel builds.

Notable utilities:
- `.search-line` — always-visible grey underline, transitions to black on focus
- `.grid-texture` — subtle background grid used on the quality page hero
- `.row-enter` — staggered row entrance animation
- `.bar-fill` — animated width bar (quality completeness bars)

### `app/page.tsx` — Search

- Inline price-constraint badge shown when a filter is active.
- "Load more" button re-fetches with `top_k + 20` (capped at 60).
- Example query chips prefill and submit simultaneously.
- `ResultRow` expands to show enriched description on click (if available).

### `app/clusters/page.tsx` — Collections

- Client-side: loads all 603 families once, sorts by product count.
- Text filter input narrows results without a round-trip.
- Paginator: 30 per page, shows up to 5 page numbers centred on current.

### `app/intent/page.tsx` — Conseil d'achat

- Three example buttons fill and submit the input.
- Skeleton loader mimics the real card layout (3 cards, fading opacity).
- `BriefBlock` components show positioning, price range, and buyer action.

### `app/analytics/page.tsx` — Tableau de bord

Six `Recharts` charts loaded from a single `/analytics` call (6 BQ views in parallel server-side):

| Section | Chart type | Data |
|---|---|---|
| Indicateurs clés | KPI cards | quality view |
| Familles produits | Horizontal bar | cluster_distribution |
| Ventes | Line chart | sales_timeline |
| Prix | Horizontal bar | pricing_per_cluster |
| Assortiment | Heatmap table | heatmap_cat_dept |
| Marques | Card grid | brands_per_cluster |

### `components/OnboardingGuide.tsx`

Shown once per browser (keyed on `localStorage["vitrine_onboarding_done"]`). Five steps with progress dots, skip button, and animated X/next CTA. Can explain technical concepts (for recruiters) without cluttering the main UI.

---

## Styling conventions

- No Tailwind component classes — inline `style` props for precise values.
- Utility classes (`flex`, `grid`, `hidden md:...`) for layout only.
- `clamp()` for all heading font sizes.
- `fr-FR` locale for all number and currency formatting.
- Responsive breakpoints: `sm` (640px) hides/shows table columns, `md` (768px) switches nav from hamburger to inline.
