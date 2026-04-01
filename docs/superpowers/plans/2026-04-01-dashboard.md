# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `DashboardPage.tsx` placeholder with a functional command-center dashboard showing stat cards and a global activity feed, with the Contract Alerts card navigating to a pre-filtered Master Grid.

**Architecture:** Create `src/api/dashboard.ts` (two Supabase query functions) and `src/hooks/useDashboard.ts` (TanStack Query wrappers). `DashboardPage.tsx` is a full rewrite composed from inline stat cards and an activity feed. `MasterGrid` gains a `contractAlertMode` prop that pre-filters rows and shows a dismissible amber banner.

**Tech Stack:** React 18, TypeScript, TanStack Query v5, Supabase JS client, Tailwind CSS, date-fns, React Router v6, Lucide React.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/api/dashboard.ts` | `getDashboardStats()` + `getRecentActivity()` + shared types |
| Create | `src/hooks/useDashboard.ts` | `useDashboardStats()` + `useRecentActivity()` TanStack Query wrappers |
| Replace | `src/pages/DashboardPage.tsx` | Full dashboard UI — stat cards + activity feed |
| Modify | `src/pages/MasterGridPage.tsx` | Read `?filter=contract_alert` URL param, pass `contractAlertMode` prop |
| Modify | `src/components/table/MasterGrid.tsx` | Accept `contractAlertMode` prop, pre-filter players, show dismissible banner |
| Modify | `SCOUT_APP_PROJECT_PLAN.md` | Mark Phase 2 and Phase 3 as ✅ COMPLETE |

---

## Task 1: Create `src/api/dashboard.ts`

**Files:**
- Create: `src/api/dashboard.ts`

- [ ] **Step 1.1: Create the file with `getDashboardStats`**

```typescript
// src/api/dashboard.ts
import { supabase } from '@/api/supabase'
import type { ActivityLogEntry } from '@/types/activity'

export interface DashboardStats {
  totalPlayers: number
  recentNotesCount: number
  contractAlertsCount: number
}

export interface ActivityWithDetails extends ActivityLogEntry {
  profiles: { full_name: string } | null
  players: { first_name: string; last_name: string } | null
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  // 12 months from today — use year+1 to avoid month-overflow edge cases
  const twelveMonthsFromNow = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate(),
  ).toISOString()
  const todayISO = now.toISOString()

  const [playersResult, notesResult, contractResult] = await Promise.all([
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived'),
    supabase
      .from('player_notes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived')
      .not('contract_expiry', 'is', null)
      .gt('contract_expiry', todayISO)
      .lte('contract_expiry', twelveMonthsFromNow),
  ])

  if (playersResult.error) throw playersResult.error
  if (notesResult.error) throw notesResult.error
  if (contractResult.error) throw contractResult.error

  return {
    totalPlayers: playersResult.count ?? 0,
    recentNotesCount: notesResult.count ?? 0,
    contractAlertsCount: contractResult.count ?? 0,
  }
}

export async function getRecentActivity(limit = 20): Promise<ActivityWithDetails[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles(full_name), players(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as unknown as ActivityWithDetails[]
}
```

- [ ] **Step 1.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors. If you see "profiles is not a valid column" — that's a Supabase type inference issue. The `as unknown as ActivityWithDetails[]` cast handles this; the query is correct at runtime.

- [ ] **Step 1.3: Commit**

```bash
git add src/api/dashboard.ts
git commit -m "feat: add getDashboardStats and getRecentActivity API functions"
```

---

## Task 2: Create `src/hooks/useDashboard.ts`

**Files:**
- Create: `src/hooks/useDashboard.ts`

- [ ] **Step 2.1: Create the hooks file**

```typescript
// src/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query'
import {
  getDashboardStats,
  getRecentActivity,
  type DashboardStats,
  type ActivityWithDetails,
} from '@/api/dashboard'

const EMPTY_STATS: DashboardStats = {
  totalPlayers: 0,
  recentNotesCount: 0,
  contractAlertsCount: 0,
}

export function useDashboardStats() {
  const query = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}

export function useRecentActivity(limit = 20) {
  const query = useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: () => getRecentActivity(limit),
    staleTime: 1000 * 60, // 1 minute
  })

  return {
    activity: query.data ?? ([] as ActivityWithDetails[]),
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
```

- [ ] **Step 2.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2.3: Commit**

```bash
git add src/hooks/useDashboard.ts
git commit -m "feat: add useDashboardStats and useRecentActivity hooks"
```

---

## Task 3: Replace `DashboardPage.tsx`

**Files:**
- Replace: `src/pages/DashboardPage.tsx`

This task replaces the 7-line placeholder with the full dashboard UI. The component has no sub-files — all helpers are defined in the same file since they're only used here.

- [ ] **Step 3.1: Replace the file entirely**

```typescript
// src/pages/DashboardPage.tsx
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, MessageSquare, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useDashboardStats, useRecentActivity } from '@/hooks/useDashboard'
import type { ActivityWithDetails } from '@/api/dashboard'

// Maps DB action_type values to human-readable verb phrases.
// "note_added" uses "added a note on" so the player name reads naturally after it.
const ACTION_LABELS: Record<string, string> = {
  player_added: 'added',
  player_updated: 'updated',
  note_added: 'added a note on',
  player_archived: 'archived',
}

function getPlayerName(entry: ActivityWithDetails): string {
  if (!entry.players) return 'a player'
  return `${entry.players.first_name} ${entry.players.last_name}`
}

function buildActionLabel(entry: ActivityWithDetails): string {
  const verb = ACTION_LABELS[entry.action_type] ?? entry.action_type
  return `${verb} ${getPlayerName(entry)}`
}

export function DashboardPage() {
  const { stats, isLoading: statsLoading } = useDashboardStats()
  const { activity, isLoading: activityLoading } = useRecentActivity(20)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* ── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Players */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats.totalPlayers}</p>
              )}
              <p className="text-sm text-gray-500">Total Players</p>
            </div>
          </div>
        </div>

        {/* Recent Notes */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <MessageSquare size={20} className="text-blue-600" />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats.recentNotesCount}</p>
              )}
              <p className="text-sm text-gray-500">Notes (last 7 days)</p>
            </div>
          </div>
        </div>

        {/* Contract Alerts — amber + clickable */}
        <Link
          to="/players?filter=contract_alert"
          className="group rounded-lg border border-amber-200 bg-amber-50 p-5 transition-colors hover:bg-amber-100"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 transition-colors group-hover:bg-amber-200">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                {statsLoading ? (
                  <div className="h-7 w-14 animate-pulse rounded bg-amber-100" />
                ) : (
                  <p
                    className={`text-2xl font-bold ${
                      stats.contractAlertsCount > 0 ? 'text-amber-700' : 'text-gray-400'
                    }`}
                  >
                    {stats.contractAlertsCount}
                  </p>
                )}
                <p className="text-sm text-amber-700">Contract Alerts</p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="flex-shrink-0 text-amber-400 transition-colors group-hover:text-amber-600"
            />
          </div>
        </Link>
      </div>

      {/* ── Activity Feed ─────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recent Activity
          </h2>
        </div>

        <div className="p-5">
          {activityLoading ? (
            // Skeleton rows
            <div className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-1 h-3 w-3 flex-shrink-0 animate-pulse rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-52 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="relative ml-1.5 border-l border-gray-200">
              {activity.map((entry) => (
                <div key={entry.id} className="mb-5 ml-4 last:mb-0">
                  {/* Timeline dot — sits on the left border */}
                  <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-900">
                    <span className="font-medium">
                      {entry.profiles?.full_name ?? 'System'}
                    </span>{' '}
                    <span className="text-gray-600">{buildActionLabel(entry)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3.3: Start dev server and verify dashboard renders**

Run: `npm run dev`

Open `http://localhost:5173` in browser. Log in if prompted. You should see:
- Page heading "Dashboard"
- Three cards in a row: Total Players, Notes (last 7 days), Contract Alerts
- Cards show `animate-pulse` skeleton while loading, then real numbers
- Contract Alerts card has amber background
- Activity feed section below cards (shows skeleton, then entries or "No activity yet.")
- No TypeScript errors in terminal

- [ ] **Step 3.4: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "feat: implement Dashboard page with stat cards and activity feed"
```

---

## Task 4: Contract Alert Filter in Master Grid

**Files:**
- Modify: `src/pages/MasterGridPage.tsx`
- Modify: `src/components/table/MasterGrid.tsx`

### Step 4A — Update `MasterGridPage.tsx`

- [ ] **Step 4A.1: Add URL param reading**

The current file is:
```typescript
import { MasterGrid } from '@/components/table/MasterGrid'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

export function MasterGridPage() {
  useRealtimeSync()
  return (
    <PageWrapper>
      <MasterGrid />
    </PageWrapper>
  )
}
```

Replace with:
```typescript
import { useSearchParams } from 'react-router-dom'
import { MasterGrid } from '@/components/table/MasterGrid'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

export function MasterGridPage() {
  useRealtimeSync()
  const [searchParams] = useSearchParams()
  const contractAlertMode = searchParams.get('filter') === 'contract_alert'

  return (
    <PageWrapper>
      <MasterGrid contractAlertMode={contractAlertMode} />
    </PageWrapper>
  )
}
```

### Step 4B — Update `MasterGrid.tsx`

`MasterGrid` currently takes no props. We need to add:
1. `contractAlertMode?: boolean` prop
2. `useNavigate` import
3. A `displayPlayers` memo that pre-filters when mode is active
4. Pass `displayPlayers` (not `players`) to `useReactTable`
5. A dismissible amber banner above the search input

- [ ] **Step 4B.1: Add prop interface and imports**

At the top of `src/components/table/MasterGrid.tsx`, change:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
```

to:

```typescript
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
```

Add the props interface immediately before the `export function MasterGrid()` line:

```typescript
interface MasterGridProps {
  contractAlertMode?: boolean
}
```

Change the function signature from:
```typescript
export function MasterGrid() {
```
to:
```typescript
export function MasterGrid({ contractAlertMode = false }: MasterGridProps) {
```

- [ ] **Step 4B.2: Add `useNavigate` call and `displayPlayers` memo**

Directly after the existing `const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)` line, add:

```typescript
  const navigate = useNavigate()

  // When contractAlertMode is active, pre-filter to players whose contracts
  // expire within the next 12 months (future-only, non-archived).
  const displayPlayers = useMemo(() => {
    if (!contractAlertMode) return players
    const now = new Date()
    const cutoff = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    return players.filter(
      (p) =>
        p.contract_expiry &&
        new Date(p.contract_expiry) > now &&
        new Date(p.contract_expiry) <= cutoff &&
        p.status !== 'archived',
    )
  }, [players, contractAlertMode])
```

- [ ] **Step 4B.3: Use `displayPlayers` in the table**

Find the `useReactTable` call. Change its `data` field:

From:
```typescript
  const table = useReactTable({
    data: players,
```

To:
```typescript
  const table = useReactTable({
    data: displayPlayers,
```

- [ ] **Step 4B.4: Add the amber filter banner**

Inside the `return (...)`, find the block that starts the search input `<div className="relative max-w-sm">`.

Add the banner **immediately before** that search div:

```typescript
        {/* Contract alert filter banner */}
        {contractAlertMode && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <span>
              Contract alert filter active — showing players with contracts expiring within 12
              months.
            </span>
            <button
              onClick={() => navigate('/players')}
              className="ml-4 flex-shrink-0 font-medium text-amber-600 hover:text-amber-800"
              aria-label="Clear contract alert filter"
            >
              ✕ Clear
            </button>
          </div>
        )}
```

- [ ] **Step 4B.5: Update row count footer**

Find the row count paragraph near the bottom:
```typescript
          <p className="text-xs text-gray-400">
            {table.getFilteredRowModel().rows.length} of {players.length} players
          </p>
```

Change `players.length` to `displayPlayers.length`:
```typescript
          <p className="text-xs text-gray-400">
            {table.getFilteredRowModel().rows.length} of {displayPlayers.length} players
          </p>
```

- [ ] **Step 4B.6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4B.7: Test the contract alert flow end-to-end**

With `npm run dev` running:

1. Open `http://localhost:5173` (Dashboard). Contract Alerts card should have amber styling.
2. Click the Contract Alerts card. Browser should navigate to `http://localhost:5173/players?filter=contract_alert`.
3. On the Players page you should see the amber banner: "Contract alert filter active — showing players with contracts expiring within 12 months."
4. Click "✕ Clear". URL should change to `/players` and the banner should disappear.
5. Navigate back to Dashboard. The stat cards and activity feed should still render correctly.

- [ ] **Step 4B.8: Commit**

```bash
git add src/pages/MasterGridPage.tsx src/components/table/MasterGrid.tsx
git commit -m "feat: add contract alert pre-filter and dismissible banner to MasterGrid"
```

---

## Task 5: Update `SCOUT_APP_PROJECT_PLAN.md`

**Files:**
- Modify: `SCOUT_APP_PROJECT_PLAN.md`

- [ ] **Step 5.1: Mark Phase 2 as complete**

Find the line:
```
### Phase 2: Core — Master Grid + Player Form
```

Change it to:
```
### Phase 2: Core — Master Grid + Player Form ✅ COMPLETE
```

Then find the end of the Phase 2 task list (the last numbered item before `### Phase 3`). Add the following line immediately after the last task:

```
**Status:** All steps done. Master Grid, PlayerFormPage, PlayerDetailPanel, PlayerStatsCard, SocialLinksDisplay, and Realtime sync are all live.
```

- [ ] **Step 5.2: Mark Phase 3 as complete**

Find the line:
```
### Phase 3: Notes + Activity
```

Change it to:
```
### Phase 3: Notes + Activity ✅ COMPLETE
```

Then find the end of the Phase 3 task list (4 items). Add immediately after the last item:

```
**Status:** All steps done. Notes API + hook + PlayerNotesTab, Activity API + hook + PlayerActivityTab, and Dashboard page (stats cards + global activity feed + contract alert navigation) are all live.
```

- [ ] **Step 5.3: Verify Phase 6 is already correct**

Find `### Phase 6`. Confirm it already contains `**Status: Frozen / On Hold**` and the Cloudflare Turnstile blocker note. No change needed — this was correct before this session.

- [ ] **Step 5.4: Commit**

```bash
git add SCOUT_APP_PROJECT_PLAN.md
git commit -m "docs: mark Phase 2 and Phase 3 as complete in project plan"
```

---

## Final Verification

- [ ] **Run `npx tsc --noEmit`** — should report zero errors across all modified files.
- [ ] **Open `http://localhost:5173`** — Dashboard loads with real data.
- [ ] **Click Contract Alerts** — navigates to `/players?filter=contract_alert`, amber banner visible.
- [ ] **Click ✕ Clear** — returns to `/players`, banner gone.
- [ ] **Check `SCOUT_APP_PROJECT_PLAN.md`** — Phase 2 and Phase 3 both show `✅ COMPLETE`.
