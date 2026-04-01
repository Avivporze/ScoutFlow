# Dashboard Page — Phase 3 Task 4 Design Spec

**Date:** 2026-04-01
**Phase:** 3 — Notes + Activity
**Status:** Approved

---

## Overview

Replace the `DashboardPage.tsx` placeholder with a functional command-center dashboard. The dashboard shows three stat cards and a global activity feed. The Contract Alerts card navigates to the Master Grid with a pre-applied contract expiry filter.

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `src/api/dashboard.ts` | `getDashboardStats()` + `getRecentActivity(limit)` |
| `src/hooks/useDashboard.ts` | TanStack Query wrappers: `useDashboardStats()` + `useRecentActivity()` |

### Modified files

| File | Change |
|---|---|
| `src/pages/DashboardPage.tsx` | Full replacement — renders stat cards + activity feed |
| `src/components/table/MasterGrid.tsx` | Add `useSearchParams` + contract alert pre-filter + dismissible banner |
| `SCOUT_APP_PROJECT_PLAN.md` | Mark Phase 2 and Phase 3 as ✅ COMPLETE |

---

## Data Layer

### `src/api/dashboard.ts`

#### `getDashboardStats(): Promise<DashboardStats>`

Three parallel Supabase queries:

1. **`totalPlayers`** — `COUNT(*)` on `players` where `status != 'archived'`
2. **`recentNotesCount`** — `COUNT(*)` on `player_notes` where `created_at >= now() - 7 days`
3. **`contractAlertsCount`** — `COUNT(*)` on `players` where:
   - `contract_expiry IS NOT NULL`
   - `contract_expiry > today` (not already expired)
   - `contract_expiry <= today + 12 months`
   - `status != 'archived'`

Returns `{ totalPlayers: number, recentNotesCount: number, contractAlertsCount: number }`.

#### `getRecentActivity(limit = 20): Promise<ActivityWithDetails[]>`

Single Supabase query:

```
SELECT *, profiles(full_name), players(first_name, last_name)
FROM activity_log
ORDER BY created_at DESC
LIMIT limit
```

New type `ActivityWithDetails` extends `ActivityLogEntry` with:
- `profiles: { full_name: string } | null`
- `players: { first_name: string; last_name: string } | null`

### `src/hooks/useDashboard.ts`

- **`useDashboardStats()`** — query key `['dashboard', 'stats']`, stale time 2 minutes
- **`useRecentActivity(limit = 20)`** — query key `['dashboard', 'activity']`, stale time 1 minute

---

## Dashboard UI (`src/pages/DashboardPage.tsx`)

### Layout

```
┌─ Dashboard ──────────────────────────────────────────┐
│                                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ 👥 12        │ │ 💬 3         │ │ ⚠️ 2          │  │
│  │ Total Players│ │ Notes (7d)   │ │ Contract     →│  │
│  └──────────────┘ └──────────────┘ └──────────────┘  │
│                                                       │
│  Recent Activity                                      │
│  ────────────────────────────────────────────────     │
│  ● Aviv Porze · added John Doe          2h ago        │
│  ● Aviv Porze · added a note on J. Doe  3h ago        │
│  ● System    · updated Carlos Ruiz      1d ago        │
└───────────────────────────────────────────────────────┘
```

### Stat cards

All cards: `bg-white`, `border border-gray-200`, `rounded-lg`, `p-5`, grid layout `grid-cols-1 sm:grid-cols-3 gap-4`.

- **Total Players** — blue-600 icon (Users), neutral card
- **Recent Notes (7 days)** — blue-600 icon (MessageSquare), neutral card
- **Contract Alerts** — amber icon (AlertTriangle), `bg-amber-50 border-amber-200` to signal urgency. Renders as a `<Link to="/players?filter=contract_alert">` with a right-arrow chevron. Shows `"0 alerts"` in muted gray when zero.

Loading state: skeleton shimmer using `animate-pulse` placeholder divs.

### Activity feed

Reuses the left-border + dot timeline pattern from `PlayerActivityTab`:
- Left border: `border-l border-gray-200 ml-3`
- Dot: `absolute -left-1.5 h-3 w-3 rounded-full border-2 border-white bg-blue-500`
- Each entry: timestamp (relative via `date-fns formatDistanceToNow`), author name, human-readable action label, player name

**Action type → human label mapping:**

| `action_type` | Label |
|---|---|
| `player_added` | `added [Player Name]` |
| `player_updated` | `updated [Player Name]` |
| `note_added` | `added a note on [Player Name]` |
| `player_archived` | `archived [Player Name]` |

Empty state: "No activity yet." centered muted text.
Loading state: 5 skeleton rows with `animate-pulse`.

---

## Contract Alert Filter in Master Grid

### URL param

Dashboard card navigates to `/players?filter=contract_alert`.

### Filter logic in `MasterGridPage.tsx`

Read `useSearchParams`. If `filter === 'contract_alert'`, pass `contractAlertMode={true}` as prop to `MasterGrid`.

### Changes to `MasterGrid.tsx`

Add optional prop `contractAlertMode?: boolean`.

When true:
1. Pre-filter `players` array before passing to TanStack Table:
   ```
   const cutoff = addMonths(new Date(), 12)
   filtered = players.filter(p =>
     p.contract_expiry &&
     new Date(p.contract_expiry) > new Date() &&
     new Date(p.contract_expiry) <= cutoff &&
     p.status !== 'archived'
   )
   ```
2. Show dismissible amber banner above the search bar:
   > "Contract alert filter active — showing players with contracts expiring within 12 months. [✕ Clear]"

   Clearing calls `navigate('/players')` (removes search param).

---

## Plan Updates

- `### Phase 2: Core — Master Grid + Player Form` → add `✅ COMPLETE` to heading + `**Status:** All steps done.` line
- `### Phase 3: Notes + Activity` → add `✅ COMPLETE` to heading + `**Status:** All steps done.`
- Phase 6 already has `**Status: Frozen / On Hold**` — no change needed.

---

## What This Does NOT Do

- No real-time subscription on dashboard stats (polling via stale time is sufficient)
- No pagination on the activity feed (20 entries is enough for MVP)
- No drill-down from activity entries to player profiles (Phase 4+ scope)
- No column-level filter integration with Phase 4's query builder — contract alert is a named preset only
