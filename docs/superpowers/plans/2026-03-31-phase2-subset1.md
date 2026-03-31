# Phase 2 Subset 1 — Types, API, MasterGrid, PlayerStatsCard

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add FBref stats columns to TypeScript types, build the API + Query layers, replace the MasterGrid stub with a full sortable/filterable TanStack Table, and create the standalone PlayerStatsCard component.

**Architecture:** Types enforce scraper-ownership at compile time (stats fields omitted from Insert/Update). All Supabase calls go through `src/api/`. TanStack Query hooks provide caching. MasterGrid uses TanStack Table v8 with `buildColumns(teamsMap)` factory for resolving team names. No inline editing in this subset — all cells read-only.

**Tech Stack:** Supabase JS v2, TanStack Query v5, TanStack Table v8, Lucide React, Tailwind CSS v3, TypeScript 5.7 (strict mode, noUnusedLocals/Params enforced)

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/types/database.ts` | Add fbref_url + stats fields to Row; exclude stats from Insert/Update |
| Modify | `src/types/player.ts` | Add `PlayerStats` convenience type |
| Create | `src/api/players.ts` | CRUD functions for players table |
| Create | `src/api/teams.ts` | Read-only fetch for internal_teams |
| Create | `src/hooks/usePlayers.ts` | TanStack Query wrapper for players |
| Create | `src/hooks/useTeams.ts` | TanStack Query wrapper for teams + teamsMap |
| Create | `src/components/table/cells/PlayerNameCell.tsx` | Renders first_name + last_name bold |
| Create | `src/components/table/cells/PositionBadge.tsx` | Colored badge by position group |
| Create | `src/components/table/cells/ContractCell.tsx` | Red + icon if expiring within 6 months |
| Create | `src/components/table/cells/StatusCell.tsx` | Colored badge for active/watchlist/archived |
| Create | `src/components/table/cells/BestFitTeamCell.tsx` | Resolves team id → name (display-only) |
| Create | `src/components/table/columns.tsx` | `buildColumns(teamsMap)` factory + `HIDDEN_BY_DEFAULT` |
| Create | `src/components/table/MasterGrid.tsx` | Full TanStack Table with sort, filter, column visibility |
| Create | `src/components/players/PlayerStatsCard.tsx` | Read-only FBref stats card |
| Modify | `src/pages/MasterGridPage.tsx` | Replace stub with MasterGrid |
| Modify | `src/i18n/en.json` | Add `grid` namespace strings |
| Modify | `src/i18n/es.json` | Add `grid` namespace strings (Spanish) |

---

## Task 1: Update TypeScript Types

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/types/player.ts`

- [ ] **Step 1.1: Add fbref_url and stats fields to `database.ts`**

In `src/types/database.ts`, find the `players` table definition and make the following changes to **Row**, **Insert**, and **Update**. The stats fields go into `Row` only — they must NOT appear in `Insert` or `Update`.

Replace the current `players` table block with:

```typescript
      players: {
        Row: {
          id: string
          first_name: string
          last_name: string
          date_of_birth: string | null
          nationality: string | null
          second_nationality: string | null
          preferred_foot: 'Left' | 'Right' | 'Both' | null
          height_cm: number | null
          weight_kg: number | null
          current_club: string | null
          league: string | null
          position: string | null
          contract_expiry: string | null
          market_value: string | null
          agent_name: string | null
          agent_contact: string | null
          transfermarkt_url: string | null
          fbref_url: string | null
          social_links: Json
          stats_matches: number
          stats_goals: number
          stats_assists: number
          stats_minutes: number
          stats_updated_at: string | null
          best_fit_team_id: string | null
          status: 'active' | 'archived' | 'watchlist'
          added_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          date_of_birth?: string | null
          nationality?: string | null
          second_nationality?: string | null
          preferred_foot?: 'Left' | 'Right' | 'Both' | null
          height_cm?: number | null
          weight_kg?: number | null
          current_club?: string | null
          league?: string | null
          position?: string | null
          contract_expiry?: string | null
          market_value?: string | null
          agent_name?: string | null
          agent_contact?: string | null
          transfermarkt_url?: string | null
          fbref_url?: string | null
          social_links?: Json
          best_fit_team_id?: string | null
          status?: 'active' | 'archived' | 'watchlist'
          added_by?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          date_of_birth?: string | null
          nationality?: string | null
          second_nationality?: string | null
          preferred_foot?: 'Left' | 'Right' | 'Both' | null
          height_cm?: number | null
          weight_kg?: number | null
          current_club?: string | null
          league?: string | null
          position?: string | null
          contract_expiry?: string | null
          market_value?: string | null
          agent_name?: string | null
          agent_contact?: string | null
          transfermarkt_url?: string | null
          fbref_url?: string | null
          social_links?: Json
          best_fit_team_id?: string | null
          status?: 'active' | 'archived' | 'watchlist'
          added_by?: string
          created_at?: string
          updated_at?: string
        }
      }
```

Note: `stats_matches`, `stats_goals`, `stats_assists`, `stats_minutes`, `stats_updated_at` appear in `Row` only. Any attempt to pass them to `addPlayer()` or `updatePlayer()` will be a TypeScript compile error.

- [ ] **Step 1.2: Add `PlayerStats` convenience type to `player.ts`**

In `src/types/player.ts`, add one export after the existing exports:

```typescript
export type PlayerStats = Pick<
  Player,
  'stats_matches' | 'stats_goals' | 'stats_assists' | 'stats_minutes' | 'stats_updated_at'
>
```

- [ ] **Step 1.3: Verify types compile**

```bash
npx tsc -p tsconfig.app.json
```

Expected: exits with no errors.

- [ ] **Step 1.4: Commit**

```bash
git add src/types/database.ts src/types/player.ts
git commit -m "feat: add fbref_url and stats columns to TypeScript types

Stats fields (stats_matches/goals/assists/minutes/updated_at) are in
Row only — excluded from Insert and Update to enforce scraper ownership
at compile time. fbref_url is in all three (user-editable in forms).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: API Layer

**Files:**
- Create: `src/api/players.ts`
- Create: `src/api/teams.ts`

- [ ] **Step 2.1: Create `src/api/players.ts`**

```typescript
import { supabase } from '@/api/supabase'
import type { Player, PlayerInsert, PlayerUpdate } from '@/types/player'

export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addPlayer(player: PlayerInsert): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert(player)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlayer(id: string, updates: PlayerUpdate): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2.2: Create `src/api/teams.ts`**

```typescript
import { supabase } from '@/api/supabase'
import type { InternalTeam } from '@/types/team'

export async function getTeams(): Promise<InternalTeam[]> {
  const { data, error } = await supabase
    .from('internal_teams')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}
```

- [ ] **Step 2.3: Verify types compile**

```bash
npx tsc -p tsconfig.app.json
```

Expected: exits with no errors.

- [ ] **Step 2.4: Commit**

```bash
git add src/api/players.ts src/api/teams.ts
git commit -m "feat: add players and teams API layer

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: TanStack Query Hooks

**Files:**
- Create: `src/hooks/usePlayers.ts`
- Create: `src/hooks/useTeams.ts`

- [ ] **Step 3.1: Create `src/hooks/usePlayers.ts`**

Note: TanStack Query v5 uses `isPending` (not `isLoading`) for the initial-fetch loading state.

```typescript
import { useQuery } from '@tanstack/react-query'
import { getPlayers } from '@/api/players'
import type { Player } from '@/types/player'

export function usePlayers() {
  const { data, isPending, error } = useQuery<Player[], Error>({
    queryKey: ['players'],
    queryFn: getPlayers,
    staleTime: 30_000,
  })
  return { players: data ?? [], isLoading: isPending, error }
}
```

- [ ] **Step 3.2: Create `src/hooks/useTeams.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { getTeams } from '@/api/teams'
import type { InternalTeam } from '@/types/team'

export function useTeams() {
  const { data } = useQuery<InternalTeam[], Error>({
    queryKey: ['teams'],
    queryFn: getTeams,
    staleTime: 5 * 60_000,
  })
  const teams = data ?? []
  const teamsMap = new Map(teams.map(t => [t.id, t.team_name]))
  return { teams, teamsMap }
}
```

- [ ] **Step 3.3: Verify types compile**

```bash
npx tsc -p tsconfig.app.json
```

Expected: exits with no errors.

- [ ] **Step 3.4: Commit**

```bash
git add src/hooks/usePlayers.ts src/hooks/useTeams.ts
git commit -m "feat: add usePlayers and useTeams TanStack Query hooks

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Custom Cell Renderers

**Files:**
- Create: `src/components/table/cells/PlayerNameCell.tsx`
- Create: `src/components/table/cells/PositionBadge.tsx`
- Create: `src/components/table/cells/ContractCell.tsx`
- Create: `src/components/table/cells/StatusCell.tsx`
- Create: `src/components/table/cells/BestFitTeamCell.tsx`

- [ ] **Step 4.1: Create `src/components/table/cells/PlayerNameCell.tsx`**

```tsx
import type { Player } from '@/types/player'

interface Props {
  player: Player
}

export function PlayerNameCell({ player }: Props) {
  return (
    <span className="font-medium text-gray-900">
      {player.first_name} {player.last_name}
    </span>
  )
}
```

- [ ] **Step 4.2: Create `src/components/table/cells/PositionBadge.tsx`**

Position groups: GK=purple, DEF (CB/LB/RB/LWB/RWB)=blue, MID (CDM/CM/CAM/LM/RM)=green, FWD (LW/RW/CF/ST)=red.

```tsx
const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-purple-100 text-purple-800',
  CB: 'bg-blue-100 text-blue-800',
  LB: 'bg-blue-100 text-blue-800',
  RB: 'bg-blue-100 text-blue-800',
  LWB: 'bg-blue-100 text-blue-800',
  RWB: 'bg-blue-100 text-blue-800',
  CDM: 'bg-green-100 text-green-800',
  CM: 'bg-green-100 text-green-800',
  CAM: 'bg-green-100 text-green-800',
  LM: 'bg-green-100 text-green-800',
  RM: 'bg-green-100 text-green-800',
  LW: 'bg-red-100 text-red-800',
  RW: 'bg-red-100 text-red-800',
  CF: 'bg-red-100 text-red-800',
  ST: 'bg-red-100 text-red-800',
}

interface Props {
  position: string | null
}

export function PositionBadge({ position }: Props) {
  if (!position) return <span className="text-gray-400">—</span>
  const colorClass = POSITION_COLORS[position] ?? 'bg-gray-100 text-gray-800'
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {position}
    </span>
  )
}
```

- [ ] **Step 4.3: Create `src/components/table/cells/ContractCell.tsx`**

Shows red text + warning icon if contract expires within 6 months (includes already-expired contracts).

```tsx
import { AlertTriangle } from 'lucide-react'

interface Props {
  contractExpiry: string | null
}

function isExpiringSoon(dateStr: string): boolean {
  const expiry = new Date(dateStr)
  const sixMonthsOut = new Date()
  sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6)
  return expiry <= sixMonthsOut
}

export function ContractCell({ contractExpiry }: Props) {
  if (!contractExpiry) return <span className="text-gray-400">—</span>

  const formatted = new Date(contractExpiry).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
  })

  if (isExpiringSoon(contractExpiry)) {
    return (
      <span className="flex items-center gap-1 font-medium text-red-600">
        <AlertTriangle size={12} />
        {formatted}
      </span>
    )
  }

  return <span className="text-gray-700">{formatted}</span>
}
```

- [ ] **Step 4.4: Create `src/components/table/cells/StatusCell.tsx`**

```tsx
const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  watchlist: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-gray-100 text-gray-600',
}

interface Props {
  status: 'active' | 'archived' | 'watchlist'
}

export function StatusCell({ status }: Props) {
  const colorClass = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${colorClass}`}
    >
      {status}
    </span>
  )
}
```

- [ ] **Step 4.5: Create `src/components/table/cells/BestFitTeamCell.tsx`**

Display-only in this subset — resolves the UUID to a team name via the teamsMap.

```tsx
interface Props {
  teamId: string | null
  teamsMap: Map<string, string>
}

export function BestFitTeamCell({ teamId, teamsMap }: Props) {
  if (!teamId) return <span className="text-gray-400">—</span>
  const name = teamsMap.get(teamId)
  return <span className="text-gray-700">{name ?? '—'}</span>
}
```

- [ ] **Step 4.6: Verify types compile**

```bash
npx tsc -p tsconfig.app.json
```

Expected: exits with no errors.

- [ ] **Step 4.7: Commit**

```bash
git add src/components/table/cells/
git commit -m "feat: add custom cell renderers for MasterGrid

PlayerNameCell, PositionBadge (color-coded by group), ContractCell
(red alert for expiry within 6 months), StatusCell (badge), and
BestFitTeamCell (display-only, resolves id -> name).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Column Definitions

**Files:**
- Create: `src/components/table/columns.tsx`

- [ ] **Step 5.1: Create `src/components/table/columns.tsx`**

The `buildColumns(teamsMap)` factory builds all 22 columns. `HIDDEN_BY_DEFAULT` is used by MasterGrid to set initial column visibility state.

```tsx
import {
  createColumnHelper,
  type ColumnDef,
  type FilterFn,
  type VisibilityState,
} from '@tanstack/react-table'
import type { Player } from '@/types/player'
import { BestFitTeamCell } from './cells/BestFitTeamCell'
import { ContractCell } from './cells/ContractCell'
import { PlayerNameCell } from './cells/PlayerNameCell'
import { PositionBadge } from './cells/PositionBadge'
import { StatusCell } from './cells/StatusCell'

// ── Helpers ────────────────────────────────────────────────────────────────

function computeAge(dob: string | null): number | null {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--
  }
  return age
}

// Show "—" only when scraper has never run (stats_updated_at is null) AND value is 0.
// If scraper has run and value is genuinely 0, show "0".
function statDisplay(value: number, updatedAt: string | null): string {
  return updatedAt === null && value === 0 ? '—' : String(value)
}

// ── Global filter ──────────────────────────────────────────────────────────

// Searches across name, club, and league. Used by MasterGrid's search input.
export const playerSearchFilter: FilterFn<Player> = (row, _columnId, filterValue) => {
  const s = String(filterValue).toLowerCase()
  const { first_name, last_name, current_club, league } = row.original
  return (
    `${first_name} ${last_name}`.toLowerCase().includes(s) ||
    (current_club?.toLowerCase().includes(s) ?? false) ||
    (league?.toLowerCase().includes(s) ?? false)
  )
}

// ── Column visibility ──────────────────────────────────────────────────────

// Columns hidden by default. Pass as initialState.columnVisibility to useReactTable.
export const HIDDEN_BY_DEFAULT: VisibilityState = {
  stats_minutes: false,
  preferred_foot: false,
  height_cm: false,
  weight_kg: false,
  second_nationality: false,
  agent_name: false,
  added_by: false,
  created_at: false,
  stats_updated_at: false,
}

// ── Column definitions ─────────────────────────────────────────────────────

const col = createColumnHelper<Player>()

export function buildColumns(teamsMap: Map<string, string>): ColumnDef<Player, unknown>[] {
  return [
    // ── Default visible ──────────────────────────────────────────────────
    col.accessor(row => `${row.first_name} ${row.last_name}`, {
      id: 'fullName',
      header: 'Name',
      cell: info => <PlayerNameCell player={info.row.original} />,
    }),
    col.accessor(row => computeAge(row.date_of_birth), {
      id: 'age',
      header: 'Age',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('nationality', {
      header: 'Nationality',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('position', {
      header: 'Position',
      cell: info => <PositionBadge position={info.getValue()} />,
    }),
    col.accessor('current_club', {
      header: 'Club',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('league', {
      header: 'League',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('contract_expiry', {
      header: 'Contract',
      cell: info => <ContractCell contractExpiry={info.getValue()} />,
    }),
    col.accessor('best_fit_team_id', {
      header: 'Best Fit',
      cell: info => <BestFitTeamCell teamId={info.getValue()} teamsMap={teamsMap} />,
    }),
    col.accessor('market_value', {
      header: 'Value',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('stats_matches', {
      header: 'M',
      cell: info => statDisplay(info.getValue(), info.row.original.stats_updated_at),
    }),
    col.accessor('stats_goals', {
      header: 'G',
      cell: info => statDisplay(info.getValue(), info.row.original.stats_updated_at),
    }),
    col.accessor('stats_assists', {
      header: 'A',
      cell: info => statDisplay(info.getValue(), info.row.original.stats_updated_at),
    }),
    col.accessor('status', {
      header: 'Status',
      cell: info => <StatusCell status={info.getValue()} />,
    }),
    // ── Hidden by default ────────────────────────────────────────────────
    col.accessor('stats_minutes', {
      header: 'Min',
      cell: info => statDisplay(info.getValue(), info.row.original.stats_updated_at),
    }),
    col.accessor('preferred_foot', {
      header: 'Foot',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('height_cm', {
      header: 'Height',
      cell: info => {
        const v = info.getValue()
        return v !== null ? `${v} cm` : '—'
      },
    }),
    col.accessor('weight_kg', {
      header: 'Weight',
      cell: info => {
        const v = info.getValue()
        return v !== null ? `${v} kg` : '—'
      },
    }),
    col.accessor('second_nationality', {
      header: '2nd Nat.',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('agent_name', {
      header: 'Agent',
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('added_by', {
      header: 'Added By',
      cell: info => (
        <span className="font-mono text-xs text-gray-400">{info.getValue().slice(0, 8)}…</span>
      ),
    }),
    col.accessor('created_at', {
      header: 'Added',
      cell: info =>
        new Date(info.getValue()).toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'short',
        }),
    }),
    col.accessor('stats_updated_at', {
      header: 'Stats Updated',
      cell: info => {
        const v = info.getValue()
        return v
          ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
          : 'Never'
      },
    }),
  ]
}
```

- [ ] **Step 5.2: Verify types compile**

```bash
npx tsc -p tsconfig.app.json
```

Expected: exits with no errors.

- [ ] **Step 5.3: Commit**

```bash
git add src/components/table/columns.tsx
git commit -m "feat: add TanStack Table column definitions for MasterGrid

22 columns total: 13 default-visible, 9 hidden-by-default.
Stats columns (M/G/A/Min) show — when scraper hasn't run yet.
buildColumns(teamsMap) factory resolves best_fit_team_id to names.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: MasterGrid Component

**Files:**
- Create: `src/components/table/MasterGrid.tsx`

- [ ] **Step 6.1: Create `src/components/table/MasterGrid.tsx`**

Full TanStack Table v8 implementation: sort, global text filter, column visibility toggle.

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Search } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useTeams } from '@/hooks/useTeams'
import { buildColumns, HIDDEN_BY_DEFAULT, playerSearchFilter } from './columns'

export function MasterGrid() {
  const { players, isLoading, error } = usePlayers()
  const { teamsMap } = useTeams()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(HIDDEN_BY_DEFAULT)
  const [globalFilter, setGlobalFilter] = useState('')
  const [showColPicker, setShowColPicker] = useState(false)

  const colPickerRef = useRef<HTMLDivElement>(null)

  // Close column picker when clicking outside
  useEffect(() => {
    if (!showColPicker) return
    function handleClickOutside(e: MouseEvent) {
      if (colPickerRef.current && !colPickerRef.current.contains(e.target as Node)) {
        setShowColPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColPicker])

  const columns = useMemo(() => buildColumns(teamsMap), [teamsMap])

  const table = useReactTable({
    data: players,
    columns,
    state: { sorting, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: playerSearchFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load players. Please refresh the page.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900">Players</h1>
        <div className="flex items-center gap-2">
          {/* Column visibility toggle */}
          <div ref={colPickerRef} className="relative">
            <button
              onClick={() => setShowColPicker(v => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Columns3 size={14} />
              Columns
            </button>
            {showColPicker && (
              <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                {table.getAllColumns().map(column => (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                    />
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id}
                  </label>
                ))}
              </div>
            )}
          </div>
          {/* Add Player — placeholder until PlayerFormModal is built */}
          <button
            disabled
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white opacity-50"
          >
            + Add Player
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Search players…"
          className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className={[
                      'border-b border-gray-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500',
                      header.column.getCanSort() ? 'cursor-pointer select-none hover:text-gray-700' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() &&
                        ({
                          asc: <ArrowUp size={11} className="text-blue-600" />,
                          desc: <ArrowDown size={11} className="text-blue-600" />,
                        }[header.column.getIsSorted() as string] ?? (
                          <ArrowUpDown size={11} className="text-gray-300" />
                        ))}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              // Skeleton rows while loading
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {table.getVisibleLeafColumns().map(col => (
                    <td key={col.id} className="px-3 py-2.5">
                      <div className="h-4 animate-pulse rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-3 py-12 text-center text-sm text-gray-400"
                >
                  No players yet.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Row count */}
      {!isLoading && (
        <p className="text-xs text-gray-400">
          {table.getFilteredRowModel().rows.length} of {players.length} players
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 6.2: Verify types compile**

```bash
npx tsc -p tsconfig.app.json
```

Expected: exits with no errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/components/table/MasterGrid.tsx
git commit -m "feat: build MasterGrid with sort, search, and column visibility

TanStack Table v8 — 22 columns, 13 default-visible, global text search
across name/club/league, sort on all columns, column picker dropdown.
Add Player button is disabled (placeholder for next subset).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: PlayerStatsCard

**Files:**
- Create: `src/components/players/PlayerStatsCard.tsx`

- [ ] **Step 7.1: Create `src/components/players/PlayerStatsCard.tsx`**

Standalone component — not wired into any page yet. Will be embedded in PlayerDetailPanel in the next subset.

```tsx
import { Activity, Clock, Target, Zap } from 'lucide-react'
import type { Player } from '@/types/player'

interface Props {
  player: Player
}

const STATS = [
  { key: 'stats_matches' as const, label: 'Matches', Icon: Activity },
  { key: 'stats_goals' as const, label: 'Goals', Icon: Target },
  { key: 'stats_assists' as const, label: 'Assists', Icon: Zap },
  { key: 'stats_minutes' as const, label: 'Minutes', Icon: Clock },
]

export function PlayerStatsCard({ player }: Props) {
  if (!player.stats_updated_at) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        No stats yet — add an FBref URL to enable scraping.
      </div>
    )
  }

  const updatedAt = new Date(player.stats_updated_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-4 gap-4">
        {STATS.map(({ key, label, Icon }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <Icon size={16} className="text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{player[key]}</span>
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">Last updated: {updatedAt}</p>
    </div>
  )
}
```

- [ ] **Step 7.2: Verify types compile**

```bash
npx tsc -p tsconfig.app.json
```

Expected: exits with no errors.

- [ ] **Step 7.3: Commit**

```bash
git add src/components/players/PlayerStatsCard.tsx
git commit -m "feat: add PlayerStatsCard component (read-only FBref stats)

Displays Matches/Goals/Assists/Minutes in a 4-column card with last-
updated timestamp. Shows a prompt to add FBref URL when no stats exist.
Not wired into any page yet — ready for PlayerDetailPanel in subset 2.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Wire MasterGridPage + i18n + Final Build

**Files:**
- Modify: `src/pages/MasterGridPage.tsx`
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/es.json`

- [ ] **Step 8.1: Replace the MasterGridPage stub**

Replace the entire contents of `src/pages/MasterGridPage.tsx` with:

```tsx
import { MasterGrid } from '@/components/table/MasterGrid'
import { PageWrapper } from '@/components/layout/PageWrapper'

export function MasterGridPage() {
  return (
    <PageWrapper>
      <MasterGrid />
    </PageWrapper>
  )
}
```

- [ ] **Step 8.2: Add `grid` section to `src/i18n/en.json`**

Add the following inside the top-level JSON object (after the existing `"pages"` key):

```json
  "grid": {
    "title": "Players",
    "searchPlaceholder": "Search players…",
    "addPlayer": "Add Player",
    "columns": "Columns",
    "noPlayers": "No players yet.",
    "loadError": "Failed to load players. Please refresh the page.",
    "rowCount": "{{filtered}} of {{total}} players",
    "statsNever": "Never",
    "statsNoData": "No stats yet — add an FBref URL to enable scraping.",
    "statsLastUpdated": "Last updated: {{date}}"
  }
```

- [ ] **Step 8.3: Add `grid` section to `src/i18n/es.json`**

Add the same keys in Spanish inside the top-level JSON object:

```json
  "grid": {
    "title": "Jugadores",
    "searchPlaceholder": "Buscar jugadores…",
    "addPlayer": "Añadir jugador",
    "columns": "Columnas",
    "noPlayers": "Aún no hay jugadores.",
    "loadError": "Error al cargar jugadores. Por favor recarga la página.",
    "rowCount": "{{filtered}} de {{total}} jugadores",
    "statsNever": "Nunca",
    "statsNoData": "Sin estadísticas aún — añade una URL de FBref para activar el scraping.",
    "statsLastUpdated": "Última actualización: {{date}}"
  }
```

- [ ] **Step 8.4: Run full build to verify everything compiles and bundles**

```bash
npm run build
```

Expected output ends with something like:
```
✓ built in Xs
```
No TypeScript errors. No Vite build errors.

- [ ] **Step 8.5: Commit**

```bash
git add src/pages/MasterGridPage.tsx src/i18n/en.json src/i18n/es.json
git commit -m "feat: wire MasterGrid into MasterGridPage, add i18n strings

Phase 2 Subset 1 complete. Types, API, hooks, cell renderers, columns,
MasterGrid, and PlayerStatsCard are all built. Ready for browser testing.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Acceptance Checklist

After all tasks are complete, verify the following in the browser (`npm run dev`):

- [ ] Navigate to `/players` — MasterGrid renders with all 13 default columns visible
- [ ] Stats columns (M, G, A) show `—` for any player with no scraper data
- [ ] Contract Expiry column shows red + warning icon for expiring contracts
- [ ] Position column renders colored badges
- [ ] Status column renders colored badges
- [ ] Click any column header → row order changes (sorting works)
- [ ] Type in the search box → rows filter by name/club/league
- [ ] Click "Columns" → dropdown shows all 22 columns as checkboxes
- [ ] Toggle a hidden column (e.g. "Min") → it appears/disappears in the table
- [ ] `npm run build` exits cleanly with no TypeScript errors
- [ ] Attempting to add `stats_matches` to a `PlayerUpdate` object causes a TS error
