---
name: Phase 4 — Advanced Filters
description: Server-side dynamic Supabase query builder driven by flat URL search params, with a fixed filter panel UI that matches the existing MasterGrid aesthetic.
type: project
---

# Phase 4: Advanced Filters — Design Spec

## Context

Phases 1–3 complete. Phase 6 (scraper) frozen. Data is manually entered. The `/filter` route exists but is a placeholder. This phase implements the full filter experience end-to-end.

## Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Filter execution | Server-side (Supabase) | Scales; required for future Alerts system which needs DB-level evaluation |
| URL encoding | Flat params (`?position=CM&minAge=18`) | Human-readable, manually tweak-able, no URL encoding noise, native `useSearchParams` support |
| Age filter | Expose Age (min/max), compute DOB bounds in query layer | Intuitive for scouts; DOB arithmetic is a one-liner |
| Filter UI | Fixed panel (not dynamic row builder) | Maps cleanly to flat params; simpler and cleaner UX |
| Multi-value fields | Comma-separated in one param (`?position=CM,CDM`) | Standard URL convention, easy to parse with `.split(',')` |

## Filterable Fields

| URL Param | Player Column | Supabase Modifier | Input Type |
|---|---|---|---|
| `search` | `first_name`, `last_name` | `.or(ilike)` | Text |
| `position` | `position` | `.in()` | Select (multi) |
| `status` | `status` | `.in()` | Select |
| `foot` | `preferred_foot` | `.eq()` | Select |
| `nationality` | `nationality` | `.ilike('%X%')` | Text |
| `league` | `league` | `.ilike('%X%')` | Text |
| `minAge` / `maxAge` | `date_of_birth` | `.lte()` / `.gte()` | Number inputs |
| `minGoals` / `maxGoals` | `stats_goals` | `.gte()` / `.lte()` | Number inputs |
| `minAssists` / `maxAssists` | `stats_assists` | `.gte()` / `.lte()` | Number inputs |
| `minMatches` / `maxMatches` | `stats_matches` | `.gte()` / `.lte()` | Number inputs |

## Age → DOB Conversion

```
maxAge=23 → DOB >= new Date(today.year - maxAge - 1, today.month, today.day + 1)
minAge=18 → DOB <= new Date(today.year - minAge, today.month, today.day)
```

Verified: a player born 2002-04-02 on 2026-04-01 is 23 (birthday tomorrow). maxAge=23 → minDOB = 2002-04-02 → they pass. A player born 2002-04-01 is 24 → minDOB = 2002-04-02 → they are excluded. ✓

## Files

1. **`src/api/players.ts`** — add `PlayerFilters` type + `filterPlayers(filters)` function
2. **`src/hooks/useFilteredPlayers.ts`** — new hook, query key `['players', 'filtered', filters]`
3. **`src/pages/AdvancedFilterPage.tsx`** — full page: URL state, filter bar, results table, CSV export

## UI Layout

```
[Title "Advanced Filter"]                         [Export CSV]
┌────────────────────────────────────────────────────────────┐
│ [Search ____________] [Position ▼] [Status ▼] [Foot ▼]    │
│ Age [__] to [__]  Goals [__] to [__]  Assists [__] to [__] Matches [__] to [__] │
│ [Nationality ____________] [League ____________]  [Clear All] │
└────────────────────────────────────────────────────────────┘
[Results table — same TanStack Table as MasterGrid]
[N players found]
```

## Tailwind Design Constraints

- Same utility classes as MasterGrid: `border border-gray-200`, `rounded-lg`, `text-sm`, `text-gray-700`
- Inputs: `rounded-md border border-gray-300 py-1.5 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500`
- Primary button: `bg-blue-600 text-white hover:bg-blue-700`
- Secondary button: `border border-gray-300 bg-white text-gray-700 hover:bg-gray-50`
- Filter panel background: `bg-gray-50 border border-gray-200 rounded-lg`

## URL State Management

- `useSearchParams()` is single source of truth
- Selects/dropdowns: update URL immediately on change
- Text inputs: local state, debounce 400ms before pushing to URL (avoids query-per-keystroke)
- `parseFilters(searchParams): PlayerFilters` — pure function, converts URL strings to typed filter object
- `setParam(key, value)` helper — sets or deletes params cleanly

## CSV Export

Client-side only. Takes the filtered `players[]` from query result, builds CSV string with standard columns (Name, Age, Position, Club, League, Nationality, Status, Goals, Assists, Matches, Minutes, Contract Expiry), triggers blob download via `<a>` element.

## Out of Scope (Phase 4)

- Saved/named filter sets
- Alerts integration (Phase 5+)
- i18n of filter labels
- Market value range filter (stored as text, not numeric)
