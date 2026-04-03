# Dashboard Cleanup & Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead code left from deleted dashboard widgets, scope the activity feed to the current user, and strip orphaned i18n keys — leaving a clean, TypeScript-verified build.

**Architecture:** All changes are surgical deletions or single-function edits in 4 files (`api/dashboard.ts`, `hooks/useDashboard.ts`, `i18n/en.json`, `i18n/es.json`). No new files. No new dependencies. The 4 active dashboard widgets are untouched.

**Tech Stack:** TypeScript, React, Supabase JS SDK v2, react-i18next

---

## File Map

| File | Change |
|---|---|
| `src/api/dashboard.ts` | Add user scoping to `getRecentActivity`; remove `getRecentProspects`, `getPositionalPipeline`, `RecentProspect` type, `watchlistCount` from `DashboardStats` |
| `src/hooks/useDashboard.ts` | Remove `usePositionalPipeline`, `useRecentProspects` hooks and their imports |
| `src/i18n/en.json` | Remove 6 orphaned keys under `dashboard` namespace |
| `src/i18n/es.json` | Remove 6 orphaned keys under `dashboard` namespace |

---

### Task 1: Scope `getRecentActivity` to current user

**Files:**
- Modify: `src/api/dashboard.ts` (the `getRecentActivity` function, currently lines 95–104)

The function currently runs without a user filter. We resolve the authenticated user first and return `[]` if none is found (security-first default), then add `.eq('user_id', user.id)`.

- [ ] **Step 1: Update `getRecentActivity` in `src/api/dashboard.ts`**

Replace the existing function (lines 95–104):

```typescript
export async function getRecentActivity(limit = 20): Promise<ActivityWithDetails[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action_type, created_at, profiles(full_name), players(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Failed to fetch recent activity.')
  return data as unknown as ActivityWithDetails[]
}
```

With:

```typescript
export async function getRecentActivity(limit = 20): Promise<ActivityWithDetails[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action_type, created_at, profiles(full_name), players(first_name, last_name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Failed to fetch recent activity.')
  return data as unknown as ActivityWithDetails[]
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/api/dashboard.ts
git commit -m "fix(security): scope activity_log feed to authenticated user only"
```

---

### Task 2: Remove orphaned API functions and `watchlistCount` from `api/dashboard.ts`

**Files:**
- Modify: `src/api/dashboard.ts`

Four items to remove:
1. `RecentProspect` type (line 21)
2. `watchlistCount` from `DashboardStats` interface (line 7) + its query and return value in `getDashboardStats`
3. `getRecentProspects()` function (lines 118–128)
4. `getPositionalPipeline()` function (lines 212–233)

- [ ] **Step 1: Remove `watchlistCount` from the `DashboardStats` interface**

Change:
```typescript
export interface DashboardStats {
  totalPlayers: number
  watchlistCount: number
  teamsScouted: number
  countriesScouted: number
}
```

To:
```typescript
export interface DashboardStats {
  totalPlayers: number
  teamsScouted: number
  countriesScouted: number
}
```

- [ ] **Step 2: Remove the `watchlistResult` query from `getDashboardStats`**

The current `Promise.all` runs 4 queries. Drop the watchlist query.

Change:
```typescript
  const [playersResult, watchlistResult, clubResult, nationalityResult] = await Promise.all([
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived'),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'watchlist'),
    supabase
      .from('players')
      .select('current_club')
      .neq('status', 'archived')
      .not('current_club', 'is', null),
    supabase
      .from('players')
      .select('nationality')
      .neq('status', 'archived')
      .not('nationality', 'is', null)
  ])

  if (playersResult.error || watchlistResult.error || clubResult.error || nationalityResult.error) {
    throw new Error('Failed to fetch dashboard stats.')
  }
```

To:
```typescript
  const [playersResult, clubResult, nationalityResult] = await Promise.all([
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived'),
    supabase
      .from('players')
      .select('current_club')
      .neq('status', 'archived')
      .not('current_club', 'is', null),
    supabase
      .from('players')
      .select('nationality')
      .neq('status', 'archived')
      .not('nationality', 'is', null)
  ])

  if (playersResult.error || clubResult.error || nationalityResult.error) {
    throw new Error('Failed to fetch dashboard stats.')
  }
```

- [ ] **Step 3: Remove `watchlistCount` from the return object in `getDashboardStats`**

Change:
```typescript
  return {
    totalPlayers: playersResult.count ?? 0,
    watchlistCount: watchlistResult.count ?? 0,
    teamsScouted: uniqueClubs.size,
    countriesScouted: uniqueCountries.size,
  }
```

To:
```typescript
  return {
    totalPlayers: playersResult.count ?? 0,
    teamsScouted: uniqueClubs.size,
    countriesScouted: uniqueCountries.size,
  }
```

- [ ] **Step 4: Remove the `RecentProspect` type**

Delete this line entirely (currently line 21):
```typescript
export type RecentProspect = Pick<Player, 'id' | 'first_name' | 'last_name' | 'nationality' | 'date_of_birth' | 'created_at'>
```

- [ ] **Step 5: Remove `getRecentProspects` function**

Delete the entire function (currently lines 118–128):
```typescript
export async function getRecentProspects(limit = 5): Promise<RecentProspect[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, nationality, date_of_birth, created_at')
    .eq('status', 'watchlist')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Failed to fetch recent prospects.')
  return data as RecentProspect[]
}
```

- [ ] **Step 6: Remove `getPositionalPipeline` function**

Delete the entire function (currently lines 212–233):
```typescript
export async function getPositionalPipeline(): Promise<{ position: string; count: number }[]> {
  const { data, error } = await supabase
    .from('players')
    .select('position')
    .neq('status', 'archived')
    .not('position', 'is', null)

  if (error) throw new Error('Failed to fetch positional pipeline.')

  const counts: Record<string, number> = {}
  data.forEach((row) => {
    const pos = row.position?.trim()
    if (pos) {
      counts[pos] = (counts[pos] || 0) + 1
    }
  })

  // Convert to array and sort by count desc
  return Object.entries(counts)
    .map(([position, count]) => ({ position, count }))
    .sort((a, b) => b.count - a.count)
}
```

- [ ] **Step 7: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors). If there are errors, they will point to `useDashboard.ts` still importing the deleted functions — Task 3 fixes those.

- [ ] **Step 8: Commit**

```bash
git add src/api/dashboard.ts
git commit -m "refactor: remove orphaned dashboard API functions and watchlistCount stat"
```

---

### Task 3: Remove orphaned hooks from `useDashboard.ts`

**Files:**
- Modify: `src/hooks/useDashboard.ts`

Two hooks to delete: `usePositionalPipeline` (lines 70–82) and `useRecentProspects` (lines 84–96). Also clean up their imports at the top.

- [ ] **Step 1: Remove the orphaned imports at the top of `useDashboard.ts`**

Change:
```typescript
import {
  getDashboardStats,
  getRecentActivity,
  getTopPerformers,
  getRecentProspects,
  getPositionalPipeline,
  getExpiringContracts,
  getHighestMarketValue,
  getScoutingGaps,
  getScoutingGapCount,
  type DashboardStats,
  type ActivityWithDetails,
  type ExpiringContract,
  type MarketValuePlayer,
  type ScoutingGapPlayer,
} from '@/api/dashboard'
```

To:
```typescript
import {
  getDashboardStats,
  getRecentActivity,
  getTopPerformers,
  getExpiringContracts,
  getHighestMarketValue,
  getScoutingGaps,
  getScoutingGapCount,
  type DashboardStats,
  type ActivityWithDetails,
  type ExpiringContract,
  type MarketValuePlayer,
  type ScoutingGapPlayer,
} from '@/api/dashboard'
```

- [ ] **Step 2: Remove the `usePositionalPipeline` hook**

Delete the entire block (currently lines 70–82):
```typescript
export function usePositionalPipeline() {
  const query = useQuery({
    queryKey: ['dashboard', 'positionalPipeline'],
    queryFn: getPositionalPipeline,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    pipeline: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
  }
}
```

- [ ] **Step 3: Remove the `useRecentProspects` hook**

Delete the entire block (currently lines 84–96):
```typescript
export function useRecentProspects(limit = 4) {
  const query = useQuery({
    queryKey: ['dashboard', 'recentProspects', limit],
    queryFn: () => getRecentProspects(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    players: query.data ?? ([] as Player[]),
    isLoading: query.isPending,
    isError: query.isError,
  }
}
```

- [ ] **Step 4: Check if the `Player` import is still needed**

After removing `useRecentProspects`, check whether `Player` (from `@/types/player`) is still used in the file. It is still used by `useTopPerformers` (line 64: `[] as Player[]`). Keep the import.

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useDashboard.ts
git commit -m "refactor: remove orphaned usePositionalPipeline and useRecentProspects hooks"
```

---

### Task 4: Remove orphaned i18n keys

**Files:**
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/es.json`

Six keys to remove from the `dashboard` namespace in both files: `pipeline`, `recentlyAdded`, `age`, `watchlistCount`, `noScoutingGaps`, `noNotesYet`.

- [ ] **Step 1: Remove 6 orphaned keys from `src/i18n/en.json`**

In the `"dashboard"` object, remove these 6 lines:
```json
"pipeline": "Positional Pipeline",
"recentlyAdded": "Recently Added",
"age": "Age",
"watchlistCount": "On Watchlist",
"noScoutingGaps": "All tracked players have notes.",
"noNotesYet": "No notes",
```

The `dashboard` block after removal should start with:
```json
"dashboard": {
  "title": "Dashboard",
  "totalPlayers": "Total Players",
  "topPerformers": "Top Performers",
  "goals": "Goals",
  "assists": "Assists",
  "teamsScouted": "Teams Scouted",
  "countriesScouted": "Countries",
  ...
```

- [ ] **Step 2: Remove 6 orphaned keys from `src/i18n/es.json`**

In the `"dashboard"` object, remove these 6 lines:
```json
"pipeline": "Pipeline de Posiciones",
"recentlyAdded": "Añadidos Recientemente",
"age": "Edad",
"watchlistCount": "En Seguimiento",
"noScoutingGaps": "Todos los jugadores tienen notas.",
"noNotesYet": "Sin notas",
```

- [ ] **Step 3: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output. (TypeScript doesn't type-check i18n key strings, but this confirms no cascading issues.)

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.json src/i18n/es.json
git commit -m "chore: remove orphaned i18n keys for deleted dashboard widgets"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors). If any errors appear, they will name the exact file and line — fix before proceeding.

- [ ] **Step 2: Verify active widget hooks and API functions are intact**

Run these greps to confirm nothing was accidentally deleted:

```bash
grep -n "useTopPerformers\|useExpiringContracts\|useHighestMarketValue\|useScoutingGapCount\|useScoutingGaps" src/hooks/useDashboard.ts
```

Expected: 5 function definitions present.

```bash
grep -n "getTopPerformers\|getExpiringContracts\|getHighestMarketValue\|getScoutingGapCount\|getScoutingGaps\b" src/api/dashboard.ts
```

Expected: 5 function definitions present.

- [ ] **Step 3: Verify active i18n keys are intact**

```bash
grep -n "topPerformers\|expiringContracts\|highestMarketValue\|scoutingGaps\|recentActivity\|totalPlayers" src/i18n/en.json
```

Expected: all 6 keys present.

- [ ] **Step 4: Confirm orphaned items are gone**

```bash
grep -rn "usePositionalPipeline\|useRecentProspects\|getRecentProspects\|getPositionalPipeline\|RecentProspect\|watchlistCount" src/
```

Expected: no matches.

```bash
grep -n "\"pipeline\"\|\"recentlyAdded\"\|\"noScoutingGaps\"\|\"noNotesYet\"\|\"watchlistCount\"" src/i18n/en.json src/i18n/es.json
```

Expected: no matches.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final verification — codebase clean and TypeScript build passing"
```

Only commit if there were any unstaged changes from the verification steps. If everything was already committed in Tasks 1–4, skip this step.
