# Phase 2 — Subset 1: Types, API, MasterGrid, PlayerStatsCard

**Date:** 2026-03-31
**Status:** Approved
**Scope:** TypeScript types → API layer → hooks → MasterGrid display → PlayerStatsCard
**Deferred:** PlayerFormModal, PlayerDetailPanel, inline editing, Realtime subscriptions

---

## 1. TypeScript Types

### `src/types/database.ts` — players table

Add 6 new fields to `players.Row`:

| Field | Type | Notes |
|---|---|---|
| `fbref_url` | `string \| null` | Editable in form (future), read-only in grid display |
| `stats_matches` | `number` | Scraper-owned, DEFAULT 0 |
| `stats_goals` | `number` | Scraper-owned, DEFAULT 0 |
| `stats_assists` | `number` | Scraper-owned, DEFAULT 0 |
| `stats_minutes` | `number` | Scraper-owned, DEFAULT 0 |
| `stats_updated_at` | `string \| null` | Scraper-owned, last scrape timestamp |

**Read-only enforcement:** `stats_matches`, `stats_goals`, `stats_assists`, `stats_minutes`, `stats_updated_at` are present in `Row` only — omitted from `Insert` and `Update`. `fbref_url` is included in `Insert` and `Update` (user enters it in the form in a future subset). Any frontend code attempting to pass stats fields to `addPlayer()` or `updatePlayer()` will cause a TypeScript compile error.

---

## 2. API Layer

### `src/api/players.ts`

Four functions, all typed via the `Database` generic on the supabase client:

- **`getPlayers()`** — `SELECT *` from players, returns `Player[]`. No server-side join; team name resolution happens client-side in the hook.
- **`addPlayer(data: PlayerInsert)`** — INSERT. `PlayerInsert` excludes stats fields by type design.
- **`updatePlayer(id: string, data: PlayerUpdate)`** — UPDATE by id. `PlayerUpdate` excludes stats fields by type design.
- **`deletePlayer(id: string)`** — DELETE by id.

### `src/api/teams.ts`

- **`getTeams()`** — `SELECT id, team_name FROM internal_teams ORDER BY sort_order`. Returns `InternalTeam[]` (convenience type from database.ts).

---

## 3. Hooks

### `src/hooks/usePlayers.ts`

TanStack Query hook wrapping `getPlayers()`:
- Query key: `['players']`
- Returns `{ players, isLoading, error }` where `players` is `Player[]`
- `staleTime: 30s`, `refetchOnWindowFocus: true`

### `src/hooks/useTeams.ts`

TanStack Query hook wrapping `getTeams()`:
- Query key: `['teams']`
- Returns `{ teams, teamsMap }` where `teamsMap` is `Map<string, string>` (id → team_name) for O(1) lookup in cells

---

## 4. MasterGrid (Approach A — display-only, full column set)

### Files

- `src/components/table/columns.tsx` — column definitions
- `src/components/table/cells/PlayerNameCell.tsx`
- `src/components/table/cells/PositionBadge.tsx`
- `src/components/table/cells/ContractCell.tsx`
- `src/components/table/cells/StatusCell.tsx`
- `src/components/table/cells/BestFitTeamCell.tsx` (display-only)
- `src/components/table/MasterGrid.tsx`
- `src/pages/MasterGridPage.tsx` (replaces stub)

### Columns

**Default visible (13):**
1. Full Name — `PlayerNameCell` (renders `first_name + last_name`, bold)
2. Age — computed from `date_of_birth` at render time; shows "—" if null
3. Nationality — text
4. Position — `PositionBadge` (colored badge per position group: GK=purple, DEF=blue, MID=green, FWD=red)
5. Current Club — text
6. League — text
7. Contract Expiry — `ContractCell` (red text + icon if < 6 months from today; "—" if null)
8. Best Fit Team — `BestFitTeamCell` (resolves id → name from teamsMap; display-only in this subset)
9. Market Value — text
10. Matches — `stats_matches`, right-aligned number; "—" if 0 and no stats_updated_at
11. Goals — `stats_goals`, same treatment
12. Assists — `stats_assists`, same treatment
13. Status — `StatusCell` (badge: Active=green, Watchlist=yellow, Archived=gray)

**Hidden by default (9):**
14. Minutes — `stats_minutes`
15. Preferred Foot — text
16. Height — `height_cm` + "cm" suffix
17. Weight — `weight_kg` + "kg" suffix
18. Second Nationality — text
19. Agent Name — text
20. Added By — `added_by` (profile id; display as truncated id for now — full name resolution deferred)
21. Created At — formatted date
22. Stats Last Updated — `stats_updated_at` formatted; "Never" if null

### Grid Features (this subset)

- Column header click → sort (asc/desc toggle)
- Column visibility toggle button (gear/columns icon, top-right of grid)
- Top bar: search input (client-side filter on name/club/league), "Add Player" button (disabled/placeholder for now)
- Empty state: "No players yet" message
- Loading state: skeleton rows or spinner
- **No inline editing** — all cells read-only. Best Fit and Status inline editing deferred to next subset.

---

## 5. PlayerStatsCard

`src/components/players/PlayerStatsCard.tsx`

**Props:** `player: Player`

**Layout:** 4-column stat grid (Matches / Goals / Assists / Minutes), each with a large number and label. Below: "Last updated: [date]" if `stats_updated_at` is set; otherwise "No stats yet — add an FBref URL to enable scraping."

**Not wired into any page in this subset.** It is a standalone component ready to be embedded in PlayerDetailPanel in a future subset.

---

## 6. What Is NOT In This Subset

- PlayerFormModal (Add/Edit)
- PlayerDetailPanel (slide-out)
- SocialLinksDisplay
- Realtime subscriptions (`useRealtimeSync.ts`)
- Inline editing for Best Fit Team or Status
- Full-name resolution for "Added By" column
- Notes thread

---

## Acceptance Criteria

- [ ] `npm run build` passes with no TypeScript errors
- [ ] Attempting to pass `stats_matches` to `updatePlayer()` causes a TS compile error
- [ ] MasterGrid renders in the browser with all 13 default columns visible
- [ ] Stats columns (Matches, Goals, Assists) display "—" for players with no scraper data
- [ ] Contract Expiry column turns red for contracts expiring within 6 months
- [ ] Column visibility toggle shows/hides columns correctly
- [ ] Sort works on all columns
- [ ] PlayerStatsCard renders correctly (testable by temporarily importing it)
