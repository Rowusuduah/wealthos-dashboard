# WealthOS Dashboard — Project Context

## What This Project Is
A personal finance dashboard for a 29-year-old Ghanaian professional (Richmond) on an F-1 OPT visa in Tampa, FL.
Built as a single-page application with dark theme, glassmorphism cards, and 8 tabbed sections.
**No frameworks. No build tools. No npm. Pure HTML/CSS/vanilla JS.**

## Key Personal Data (DO NOT CHANGE without user confirmation)
- Net per paycheck: $2,805.77 (26 pay periods/year)
- Gross salary: $87,000/year
- Federal tax per paycheck: ~$540.38 (no FICA on OPT F-1, no FL state income tax)
- Net per year: ~$72,950
- Living situation: Tampa, FL · Age 29 · Firstborn of 10 siblings

## Project Structure
```
Website building/
├── index.html          ← Semantic HTML shell with ARIA, meta tags, skip link
├── manifest.json       ← PWA manifest
├── sw.js               ← Service worker (cache-first, offline support)
├── css/
│   ├── styles.css      ← All component styles + design tokens + utilities
│   └── print.css       ← Print-specific overrides
├── js/
│   ├── data.js         ← All constants: S, ML, KPI_DATA, CHECKLIST_ITEMS, etc.
│   └── app.js          ← All render functions, event handlers, localStorage
├── icons/
│   ├── icon-192.png    ← PWA icon
│   └── icon-512.png    ← PWA icon
├── CLAUDE.md           ← This file
├── .claude/
│   └── settings.json   ← Claude Code project configuration
└── WealthOS_Dashboard.html  ← Original monolithic backup (do not delete)
```

## Design System (DO NOT change without user approval)
- **Font:** System stack — `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
- **Background:** `#0c0c12` (`--bg`)
- **Surface:** `#14141e` (`--surf`), `#1c1c28` (`--surf2`)
- **Muted text:** `#8a8aa6` (`--muted`) — WCAG AA compliant at 5.3:1 on `--bg`
- **Borders:** `rgba(255,255,255,0.07)` (`--border`), `rgba(255,255,255,0.13)` (`--brig`)
- **Accent colors:**
  - Green: `#4ade80` — primary positive/savings
  - Purple: `#a78bfa` — secondary/H1B
  - Orange: `#fb923c` — warning/exploration
  - Gold: `#fbbf24` — milestone/ring
  - Red: `#f87171` — Ghana/alert
  - Blue: `#60a5fa` — housing/info
  - Teal: `#2dd4bf` — roadmap
  - Pink: `#f472b6` — subscriptions

## Data Architecture
All budget data lives in `js/data.js`. Core constants:

**`NET`** — biweekly net take-home ($2,805.77). Drives all percentage calculations.

**`S` array** — budget categories. Each entry:
```js
{
  id: "giving",       // string identifier
  l: "Giving",        // display label
  e: "🙏",            // emoji (wrap in <span aria-hidden="true"> when rendering)
  c: "#a78bfa",       // hex color
  items: [            // line items
    { n: "Tithe", bw: 280.58, nt: "Note text.", b: 1 }
    //      n=name, bw=biweekly amount, nt=note, b=1 means "flexible/estimated"
  ],
  sub: 300.58         // biweekly subtotal (sum of items[].bw)
}
```

**Period multipliers:**
- Biweekly: ×1
- Monthly: ×(26/12)
- Annual: ×26

**Money formatting:** `value.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})`

## Tab Overview (8 tabs)
1. **Overview** — KPI grid, donut SVG allocation chart, spending bars, Year 2 acceleration panel
2. **Budget** — Searchable card grid of all categories with BW/Mo/Yr toggle
3. **Full Table** — Complete line-item table with period toggle + Export CSV + Print buttons
4. **Wealth** — Portfolio goal progress bars, 31-year projection timeline
5. **Relationship** — Dating budget, Tampa date ideas, marriage milestone planning
6. **Ghana** — Family remittance breakdown, long-term Ghana plan
7. **Roadmap** — 5-phase career/wealth roadmap cards (Week 1 → Year 5+)
8. **Checklist** — 24-item prioritized action checklist (persisted via localStorage)

## Key Features & Conventions
- **Checklist persistence:** `localStorage.getItem('wealthos_checklist')` stores done-state JSON
- **Export CSV:** Full Table tab has "Export CSV" button — generates Blob download
- **Print:** Full Table tab has "Print" button — triggers `window.print()` with `css/print.css`
- **Health insurance field:** `$0.00 ⚠` — user must update after HR Day 1 (editable in-place)
- **ARIA tab pattern:** `role="tablist"` on nav, `role="tab"` + `aria-selected` on buttons, `role="tabpanel"` on sections
- **Keyboard nav:** Arrow keys navigate between tabs in nav
- **No inline onclick:** All events attached via `addEventListener` in `app.js`

## Known Issues / Watch Out For
- The Excel source (`Complete_Wealth_Budget_Tampa_FINAL.xlsx`) is present but data was already extracted
- Health insurance cost is `$0.00` — placeholder until user gets HR deduction info
- If the user changes their paycheck amount: update `NET` in `data.js` only

## Dev Commands
- Open `index.html` directly in browser (no server needed for basic use)
- For PWA/service worker testing: `python -m http.server 8000` then open `http://localhost:8000`

## Session History
- **Session 1:** Created the initial monolithic `WealthOS_Dashboard.html` from Excel source data
- **Session 2:** Refactored into multi-file structure, added accessibility (ARIA, WCAG AA), PWA support, localStorage checklist persistence, export/print, industry standard improvements
