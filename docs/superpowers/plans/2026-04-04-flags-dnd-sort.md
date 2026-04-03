# Flags, Row DnD, and Sort Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add country flag icons to the Master Grid, persistent manual row reordering via drag-and-drop, and a `sort_order` database column to make that ordering permanent.

**Architecture:** A new `sort_order` integer column on `players` (initialized in order of `created_at`) becomes the default sort for `getPlayers()`. `MasterGrid` gains a vertical `@dnd-kit` context around rows (separate from the existing horizontal column-DnD context), with a debounced bulk-update on drag end. Flags are rendered via FlagCDN `<img>` using two static lookup maps (`TM_COUNTRY_ISO`, `LEAGUE_ISO`) in a new `countryIso.ts` utility file.

**Tech Stack:** Supabase SQL migrations, `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/modifiers` (all already installed), `@tanstack/react-table` v8, `@tanstack/react-virtual`, FlagCDN (no npm install needed), TypeScript, React 18.

---

## File Map

| Path | Action | Responsibility |
|---|---|---|
| `supabase/migrations/006_add_player_sort_order.sql` | **Create** | Adds `sort_order` column, initialises values, adds index |
| `src/types/database.ts` | **Modify** | Adds `sort_order: number` to players Row / Insert / Update |
| `src/lib/countryIso.ts` | **Create** | Exports `TM_COUNTRY_ISO` and `LEAGUE_ISO` lookup maps |
| `src/api/players.ts` | **Modify** | Changes `getPlayers` order; adds `bulkUpdateSortOrder`; updates `addPlayer` to append new rows |
| `src/components/table/columns.tsx` | **Modify** | Adds `FlagIcon` helper; adds flag to `nationality` and `league` cell renderers |
| `src/components/table/MasterGrid.tsx` | **Modify** | Adds `drag` column, `localPlayerOrder` state, vertical DnD context, `SortableRow`, debounced save |

---

## Task 1: SQL Migration — `sort_order` column

**Files:**
- Create: `supabase/migrations/006_add_player_sort_order.sql`

- [ ] **Step 1.1: Write the migration file**

```sql
-- supabase/migrations/006_add_player_sort_order.sql
-- Adds manual sort_order to players, mirroring internal_teams pattern.

ALTER TABLE players
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Initialise each user's players with sequential order by creation date.
-- PARTITION BY added_by so each user gets their own 1, 2, 3… sequence.
WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY added_by ORDER BY created_at) AS rn
  FROM players
)
UPDATE players
SET sort_order = ordered.rn
FROM ordered
WHERE players.id = ordered.id;

-- Composite index: fast per-user ordered fetch
CREATE INDEX idx_players_sort_order ON players (added_by, sort_order);
```

- [ ] **Step 1.2: Apply the migration in Supabase**

In the Supabase Dashboard → SQL Editor, paste and run the file content.
Expected: no errors; `\d players` shows the new `sort_order` column.

- [ ] **Step 1.3: Verify the data**

Run this query in SQL Editor:
```sql
SELECT added_by, sort_order, first_name, last_name, created_at
FROM players
ORDER BY added_by, sort_order
LIMIT 20;
```
Expected: rows ordered 1, 2, 3… within each `added_by` group, matching `created_at` ascending order.

- [ ] **Step 1.4: Commit the migration file**

```bash
git add supabase/migrations/006_add_player_sort_order.sql
git commit -m "chore(db): add sort_order column to players"
```

---

## Task 2: TypeScript Types — add `sort_order` to database.ts

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 2.1: Add `sort_order` to the players Row type**

In `src/types/database.ts`, find the `players` → `Row` block and add the field after `updated_at`:

```typescript
// Before (last few lines of Row):
          added_by: string
          created_at: string
          updated_at: string

// After:
          added_by: string
          created_at: string
          updated_at: string
          sort_order: number
```

- [ ] **Step 2.2: Add `sort_order` to the players Insert type**

In the `Insert` block, add after `updated_at?`:

```typescript
          created_at?: string
          updated_at?: string
          sort_order?: number
```

- [ ] **Step 2.3: Add `sort_order` to the players Update type**

In the `Update` block, add after `updated_at?`:

```typescript
          created_at?: string
          updated_at?: string
          sort_order?: number
```

- [ ] **Step 2.4: Verify TypeScript compiles**

```bash
cd /Users/avivporze/Desktop/Programming/Scout && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2.5: Commit**

```bash
git add src/types/database.ts
git commit -m "chore(types): add sort_order to Player DB types"
```

---

## Task 3: Country ISO Maps — `countryIso.ts`

**Files:**
- Create: `src/lib/countryIso.ts`

- [ ] **Step 3.1: Create the file with TM_COUNTRY_ISO and LEAGUE_ISO**

```typescript
// src/lib/countryIso.ts
// Maps Transfermarkt full English country/league names to ISO 3166-1 alpha-2 codes.
// Used by FlagCDN: https://flagcdn.com/w20/{iso}.png
// Missing keys render text only (no broken image).

export const TM_COUNTRY_ISO: Record<string, string> = {
  'Afghanistan': 'af',
  'Albania': 'al',
  'Algeria': 'dz',
  'Andorra': 'ad',
  'Angola': 'ao',
  'Argentina': 'ar',
  'Armenia': 'am',
  'Australia': 'au',
  'Austria': 'at',
  'Azerbaijan': 'az',
  'Bahrain': 'bh',
  'Belarus': 'by',
  'Belgium': 'be',
  'Benin': 'bj',
  'Bolivia': 'bo',
  'Bosnia-Herzegovina': 'ba',
  'Brazil': 'br',
  'Bulgaria': 'bg',
  'Burkina Faso': 'bf',
  'Burundi': 'bi',
  'Cameroon': 'cm',
  'Canada': 'ca',
  'Cape Verde': 'cv',
  'Central African Republic': 'cf',
  'Chad': 'td',
  'Chile': 'cl',
  'China': 'cn',
  'Colombia': 'co',
  'Comoros': 'km',
  'Congo': 'cg',
  'Congo DR': 'cd',
  'Democratic Republic of Congo': 'cd',
  'Costa Rica': 'cr',
  'Croatia': 'hr',
  'Cuba': 'cu',
  'Cyprus': 'cy',
  'Czech Republic': 'cz',
  'Czechia': 'cz',
  'Denmark': 'dk',
  'Djibouti': 'dj',
  'Dominican Republic': 'do',
  'Ecuador': 'ec',
  'Egypt': 'eg',
  'El Salvador': 'sv',
  'England': 'gb-eng',
  'Equatorial Guinea': 'gq',
  'Eritrea': 'er',
  'Estonia': 'ee',
  'Ethiopia': 'et',
  'Finland': 'fi',
  'France': 'fr',
  'Gabon': 'ga',
  'Gambia': 'gm',
  'Georgia': 'ge',
  'Germany': 'de',
  'Ghana': 'gh',
  'Greece': 'gr',
  'Guatemala': 'gt',
  'Guinea': 'gn',
  'Guinea-Bissau': 'gw',
  'Haiti': 'ht',
  'Honduras': 'hn',
  'Hungary': 'hu',
  'Iceland': 'is',
  'India': 'in',
  'Indonesia': 'id',
  'Iran': 'ir',
  'Iraq': 'iq',
  'Ireland': 'ie',
  'Republic of Ireland': 'ie',
  'Israel': 'il',
  'Italy': 'it',
  'Ivory Coast': 'ci',
  "Côte d'Ivoire": 'ci',
  'Jamaica': 'jm',
  'Japan': 'jp',
  'Jordan': 'jo',
  'Kazakhstan': 'kz',
  'Kenya': 'ke',
  'Kosovo': 'xk',
  'Kuwait': 'kw',
  'Latvia': 'lv',
  'Lebanon': 'lb',
  'Liberia': 'lr',
  'Libya': 'ly',
  'Liechtenstein': 'li',
  'Lithuania': 'lt',
  'Luxembourg': 'lu',
  'North Macedonia': 'mk',
  'Madagascar': 'mg',
  'Malawi': 'mw',
  'Malaysia': 'my',
  'Mali': 'ml',
  'Malta': 'mt',
  'Mauritania': 'mr',
  'Mauritius': 'mu',
  'Mexico': 'mx',
  'Moldova': 'md',
  'Montenegro': 'me',
  'Morocco': 'ma',
  'Mozambique': 'mz',
  'Namibia': 'na',
  'Netherlands': 'nl',
  'New Zealand': 'nz',
  'Nicaragua': 'ni',
  'Niger': 'ne',
  'Nigeria': 'ng',
  'Northern Ireland': 'gb-nir',
  'Norway': 'no',
  'Oman': 'om',
  'Pakistan': 'pk',
  'Palestine': 'ps',
  'Panama': 'pa',
  'Paraguay': 'py',
  'Peru': 'pe',
  'Philippines': 'ph',
  'Poland': 'pl',
  'Portugal': 'pt',
  'Qatar': 'qa',
  'Romania': 'ro',
  'Russia': 'ru',
  'Rwanda': 'rw',
  'Saudi Arabia': 'sa',
  'Scotland': 'gb-sct',
  'Senegal': 'sn',
  'Serbia': 'rs',
  'Sierra Leone': 'sl',
  'Slovakia': 'sk',
  'Slovenia': 'si',
  'Somalia': 'so',
  'South Africa': 'za',
  'South Korea': 'kr',
  'South Sudan': 'ss',
  'Spain': 'es',
  'Sudan': 'sd',
  'Sweden': 'se',
  'Switzerland': 'ch',
  'Syria': 'sy',
  'Tanzania': 'tz',
  'Thailand': 'th',
  'Togo': 'tg',
  'Trinidad and Tobago': 'tt',
  'Tunisia': 'tn',
  'Turkey': 'tr',
  'Türkiye': 'tr',
  'Uganda': 'ug',
  'Ukraine': 'ua',
  'United Arab Emirates': 'ae',
  'United States': 'us',
  'Uruguay': 'uy',
  'Uzbekistan': 'uz',
  'Venezuela': 've',
  'Vietnam': 'vn',
  'Wales': 'gb-wls',
  'Yemen': 'ye',
  'Zambia': 'zm',
  'Zimbabwe': 'zw',
}

// Maps Transfermarkt league name strings to the country ISO code for its flag.
// Keys must match exactly what TM scrapes into the `league` column.
export const LEAGUE_ISO: Record<string, string> = {
  // England
  'Premier League': 'gb-eng',
  'Championship': 'gb-eng',
  'League One': 'gb-eng',
  'League Two': 'gb-eng',
  // Germany
  'Bundesliga': 'de',
  '2. Bundesliga': 'de',
  '3. Liga': 'de',
  // Spain
  'LaLiga': 'es',
  'La Liga': 'es',
  'LaLiga2': 'es',
  'Segunda División': 'es',
  // Italy
  'Serie A': 'it',
  'Serie B': 'it',
  // France
  'Ligue 1': 'fr',
  'Ligue 2': 'fr',
  // Portugal
  'Primeira Liga': 'pt',
  'Liga Portugal': 'pt',
  'Liga Portugal 2': 'pt',
  // Netherlands
  'Eredivisie': 'nl',
  'Eerste Divisie': 'nl',
  // Belgium
  'Belgian Pro League': 'be',
  'First Division A': 'be',
  // Turkey
  'Süper Lig': 'tr',
  'Super Lig': 'tr',
  'TFF First League': 'tr',
  // Russia
  'Russian Premier League': 'ru',
  'Premier League Russia': 'ru',
  // Ukraine
  'Ukrainian Premier League': 'ua',
  // Greece
  'Super League Greece': 'gr',
  'Super League 2': 'gr',
  // Scotland
  'Scottish Premiership': 'gb-sct',
  // Switzerland
  'Swiss Super League': 'ch',
  // Austria
  'Austrian Football Bundesliga': 'at',
  'Bundesliga Austria': 'at',
  // Czech Republic
  'Czech First League': 'cz',
  'Fortuna liga': 'cz',
  // Poland
  'Ekstraklasa': 'pl',
  // Romania
  'Liga I': 'ro',
  'Romanian Liga I': 'ro',
  // Hungary
  'OTP Bank Liga': 'hu',
  'Nemzeti Bajnokság I': 'hu',
  // Croatia
  'Hrvatska nogometna liga': 'hr',
  'HNL': 'hr',
  // Serbia
  'Serbian SuperLiga': 'rs',
  'Super liga Srbije': 'rs',
  // Israel
  "Israeli Premier League": 'il',
  "Ligat ha'Al": 'il',
  'National League Israel': 'il',
  // Denmark
  'Superligaen': 'dk',
  // Sweden
  'Allsvenskan': 'se',
  // Norway
  'Eliteserien': 'no',
  // Argentina
  "Argentine Primera División": 'ar',
  'Primera División': 'ar',
  // Brazil
  'Série A': 'br',
  'Serie A Brazil': 'br',
  // USA
  'MLS': 'us',
  'Major League Soccer': 'us',
  // Mexico
  'Liga MX': 'mx',
  // Japan
  'J1 League': 'jp',
  // South Korea
  'K League 1': 'kr',
  // Saudi Arabia
  'Saudi Pro League': 'sa',
  'Saudi Professional League': 'sa',
  // China
  'Chinese Super League': 'cn',
  // Morocco
  'Botola Pro': 'ma',
  // Egypt
  'Egyptian Premier League': 'eg',
  // South Africa
  'DStv Premiership': 'za',
  'PSL': 'za',
}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

```bash
cd /Users/avivporze/Desktop/Programming/Scout && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/countryIso.ts
git commit -m "feat: add TM country and league ISO lookup maps"
```

---

## Task 4: API Updates — `players.ts`

**Files:**
- Modify: `src/api/players.ts`

- [ ] **Step 4.1: Change `getPlayers` to order by `sort_order`**

In `src/api/players.ts`, find and replace the `getPlayers` function:

```typescript
// Before:
export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return data
}

// After:
export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) {
    throw error
  }
  return data
}
```

- [ ] **Step 4.2: Update `addPlayer` to append new players at the bottom**

Replace the entire `addPlayer` function:

```typescript
export async function addPlayer(player: PlayerInsert): Promise<Player> {
  // Determine the next sort_order for this user so new players go to the bottom.
  const addedBy = player.added_by ?? (await supabase.auth.getUser()).data.user?.id
  const { data: maxRow } = await supabase
    .from('players')
    .select('sort_order')
    .eq('added_by', addedBy)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sort_order = ((maxRow?.sort_order) ?? -1) + 1

  const { data, error } = await supabase
    .from('players')
    .insert({ ...player, sort_order })
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}
```

- [ ] **Step 4.3: Add `bulkUpdateSortOrder` function**

Add this new exported function after `updatePlayer`:

```typescript
/**
 * Persists manual row-drag reordering.
 * Fires all updates in parallel — safe for < 500 players.
 * Called after a debounce so rapid drags don't flood the DB.
 */
export async function bulkUpdateSortOrder(
  updates: { id: string; sort_order: number }[],
): Promise<void> {
  await Promise.all(
    updates.map(({ id, sort_order }) =>
      supabase.from('players').update({ sort_order }).eq('id', id),
    ),
  )
}
```

- [ ] **Step 4.4: Verify TypeScript compiles**

```bash
cd /Users/avivporze/Desktop/Programming/Scout && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4.5: Commit**

```bash
git add src/api/players.ts
git commit -m "feat(api): order players by sort_order, add bulk sort update"
```

---

## Task 5: Flag Icons — `columns.tsx`

**Files:**
- Modify: `src/components/table/columns.tsx`

- [ ] **Step 5.1: Add the `FlagIcon` helper component and imports**

At the top of `src/components/table/columns.tsx`, add the import for the ISO maps immediately after the existing imports:

```typescript
import { TM_COUNTRY_ISO, LEAGUE_ISO } from '@/lib/countryIso'
```

Then, below all imports and before the `computeAge` function, add the `FlagIcon` helper:

```typescript
// ── Flag Icon ───────────────────────────────────────────────────────────────

function FlagIcon({ iso }: { iso: string }) {
  return (
    <img
      src={`https://flagcdn.com/w20/${iso}.png`}
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
      className="inline w-4 h-3 mr-1 rounded-sm align-middle"
      alt=""
      aria-hidden="true"
    />
  )
}
```

- [ ] **Step 5.2: Update the `nationality` column cell renderer**

Find the `nationality` accessor in `buildColumns` and replace its `cell`:

```typescript
// Before:
col.accessor('nationality', {
  header: t('columnHeaders.nationality'),
  cell: info => info.getValue() ?? '—',
}),

// After:
col.accessor('nationality', {
  header: t('columnHeaders.nationality'),
  cell: info => {
    const v = info.getValue()
    if (!v) return '—'
    const iso = TM_COUNTRY_ISO[v]
    return (
      <span className="flex items-center gap-0.5">
        {iso && <FlagIcon iso={iso} />}
        {v}
      </span>
    )
  },
}),
```

- [ ] **Step 5.3: Update the `league` column cell renderer**

Find the `league` accessor and replace its `cell`:

```typescript
// Before:
col.accessor('league', {
  header: t('columnHeaders.league'),
  cell: info => info.getValue() ?? '—',
}),

// After:
col.accessor('league', {
  header: t('columnHeaders.league'),
  cell: info => {
    const v = info.getValue()
    if (!v) return '—'
    const iso = LEAGUE_ISO[v]
    return (
      <span className="flex items-center gap-0.5">
        {iso && <FlagIcon iso={iso} />}
        {v}
      </span>
    )
  },
}),
```

- [ ] **Step 5.4: Verify TypeScript compiles**

```bash
cd /Users/avivporze/Desktop/Programming/Scout && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5.5: Visual check in dev server**

```bash
cd /Users/avivporze/Desktop/Programming/Scout && npm run dev
```

Open the Master Grid. Verify:
- Nationality cells show the correct flag before the country name
- League cells show the correct flag before the league name
- A missing/unknown country renders text only (no broken image icon)

- [ ] **Step 5.6: Commit**

```bash
git add src/components/table/columns.tsx
git commit -m "feat(ui): add FlagCDN flag icons to nationality and league columns"
```

---

## Task 6: Row Drag-and-Drop — `MasterGrid.tsx`

This is the largest change. Work through it step by step.

**Files:**
- Modify: `src/components/table/MasterGrid.tsx`

### Step 6A: Update imports

- [ ] **Step 6A.1: Update @dnd-kit imports**

Replace the existing `@dnd-kit` import block (lines 23–41 in the current file) with:

```typescript
// DnD & Virtualization
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'
```

- [ ] **Step 6A.2: Add API import**

Add `bulkUpdateSortOrder` to the existing players hook import. Near the top of the file, the existing import is:

```typescript
import { usePlayers } from '@/hooks/usePlayers'
```

Add a second import line directly below it:

```typescript
import { bulkUpdateSortOrder } from '@/api/players'
```

Also add `useRef` to the React import if it isn't already there. The current import is:
```typescript
import { useEffect, useMemo, useRef, useState } from 'react'
```
`useRef` is already imported — no change needed.

### Step 6B: Add `SortableRow` component

- [ ] **Step 6B.1: Add the `SortableRow` component**

Add this component immediately after the closing `}` of the existing `DraggableHeader` component (around line 108 of the original file):

```typescript
interface SortableRowProps {
  row: Row<Player>
  isDndDisabled: boolean
}

const SortableRow = ({ row, isDndDisabled }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.original.id,
    disabled: isDndDisabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50 h-[45px]">
      {row.getVisibleCells().map(cell => {
        if (cell.column.id === 'drag') {
          return (
            <td key={cell.id} className="py-2.5 px-2 w-8">
              {!isDndDisabled && (
                <button
                  {...attributes}
                  {...listeners}
                  className="cursor-grab text-gray-300 hover:text-gray-500 focus:outline-none touch-none"
                  aria-label="Drag to reorder player"
                >
                  <GripVertical size={14} />
                </button>
              )}
            </td>
          )
        }
        return (
          <td key={cell.id} className="py-2.5 px-3">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        )
      })}
    </tr>
  )
}
```

### Step 6C: Add state and memos inside `MasterGrid`

- [ ] **Step 6C.1: Add `localPlayerOrder` state and `pendingOrderRef`**

Inside the `MasterGrid` function body, after the existing state declarations, add:

```typescript
// Manual row order — initialised from DB-sorted players, updated on drag
const [localPlayerOrder, setLocalPlayerOrder] = useState<string[]>([])
const pendingOrderRef = useRef<string[]>([])
const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

// Sync order from DB on initial load and after query re-fetch
useEffect(() => {
  setLocalPlayerOrder(players.map(p => p.id))
}, [players])
```

- [ ] **Step 6C.2: Add `orderedPlayers` memo**

Directly below the existing `displayPlayers` useMemo, add:

```typescript
// When a header sort is active, TanStack Table handles ordering.
// Otherwise, respect the manual localPlayerOrder (source of truth).
const orderedPlayers = useMemo(() => {
  if (sorting.length > 0 || localPlayerOrder.length === 0) return displayPlayers
  const idToPlayer = new Map(displayPlayers.map(p => [p.id, p]))
  return localPlayerOrder
    .filter(id => idToPlayer.has(id))
    .map(id => idToPlayer.get(id)!)
}, [displayPlayers, localPlayerOrder, sorting])
```

- [ ] **Step 6C.3: Add the `drag` column definition**

Replace the existing `columns` useMemo:

```typescript
// Before:
const columns = useMemo(
  () => buildColumns(setSelectedPlayer, t),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [i18n.language],
)

// After:
const columns = useMemo(
  (): ColumnDef<Player, unknown>[] => [
    // Non-data drag-handle column — not toggleable, not sortable
    {
      id: 'drag',
      header: '',
      size: 32,
      enableSorting: false,
      enableHiding: false,
      cell: () => null, // handle rendered by SortableRow
    },
    ...buildColumns(setSelectedPlayer, t),
  ],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [i18n.language],
)
```

- [ ] **Step 6C.4: Update `columnOrder` initial state to include `drag`**

Replace the `columnOrder` state initialiser:

```typescript
// Before:
const [columnOrder, setColumnOrder] = useState<string[]>(
  () => loadJson(LS_COL_ORDER, []),
)

// After:
const [columnOrder, setColumnOrder] = useState<string[]>(() => {
  const saved = loadJson<string[]>(LS_COL_ORDER, [])
  // Migration: ensure `drag` column is always first (handles existing saved orders)
  if (saved.length > 0 && !saved.includes('drag')) {
    return ['drag', ...saved]
  }
  return saved
})
```

- [ ] **Step 6C.5: Pass `orderedPlayers` to `useReactTable`**

Replace `data: displayPlayers` with `data: orderedPlayers` in the `useReactTable` call:

```typescript
// Before:
const table = useReactTable({
  data: displayPlayers,
  // ...

// After:
const table = useReactTable({
  data: orderedPlayers,
  // ...
```

### Step 6D: Add drag handlers

- [ ] **Step 6D.1: Rename `handleDragEnd` → `handleColumnDragEnd` and guard `drag` column**

Replace the existing `handleDragEnd` function:

```typescript
// Before:
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (active && over && active.id !== over.id) {
    setColumnOrder((order) => {
      const currentOrder = order.length > 0
        ? order
        : table.getAllLeafColumns().map(c => c.id)

      const oldIndex = currentOrder.indexOf(active.id as string)
      const newIndex = currentOrder.indexOf(over.id as string)
      return arrayMove(currentOrder, oldIndex, newIndex)
    })
  }
}

// After:
function handleColumnDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (active && over && active.id !== over.id) {
    // Prevent moving the drag-handle column itself
    if (active.id === 'drag' || over.id === 'drag') return
    setColumnOrder((order) => {
      const currentOrder = order.length > 0
        ? order
        : table.getAllLeafColumns().map(c => c.id)
      const oldIndex = currentOrder.indexOf(active.id as string)
      const newIndex = currentOrder.indexOf(over.id as string)
      return arrayMove(currentOrder, oldIndex, newIndex)
    })
  }
}
```

- [ ] **Step 6D.2: Add `handleRowDragEnd`**

Immediately after `handleColumnDragEnd`, add:

```typescript
function handleRowDragEnd(event: DragEndEvent) {
  const { active, over } = event
  if (!over || active.id === over.id) return

  const oldIndex = localPlayerOrder.indexOf(active.id as string)
  const newIndex = localPlayerOrder.indexOf(over.id as string)
  if (oldIndex === -1 || newIndex === -1) return

  const newOrder = arrayMove(localPlayerOrder, oldIndex, newIndex)
  setLocalPlayerOrder(newOrder)
  pendingOrderRef.current = newOrder

  // Debounce DB write — batches rapid consecutive drags
  if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
  debouncedSaveRef.current = setTimeout(async () => {
    const updates = pendingOrderRef.current.map((id, i) => ({ id, sort_order: i }))
    await bulkUpdateSortOrder(updates)
  }, 400)
}
```

### Step 6E: Restructure the table JSX

- [ ] **Step 6E.1: Replace the table container JSX**

Find the table container block (starting at `<div ref={tableContainerRef} ...>` and ending at its closing `</div>`) and replace it entirely with:

```tsx
{/* Table Container */}
<div
  ref={tableContainerRef}
  className="relative overflow-x-auto overflow-y-auto rounded-lg border border-gray-200"
  style={{ maxHeight: 'min(70vh, 800px)' }}
>
  <table className="w-full border-collapse text-sm min-w-max">
    {/* Column DnD: horizontal, restricted to header */}
    <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
      <DndContext
        collisionDetection={closestCenter}
        modifiers={[restrictToHorizontalAxis]}
        onDragEnd={handleColumnDragEnd}
        sensors={sensors}
      >
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            <SortableContext
              items={headerGroup.headers.map(h => h.column.id)}
              strategy={horizontalListSortingStrategy}
            >
              {headerGroup.headers.map(header => (
                <DraggableHeader key={header.id} header={header as Header<Player, unknown>} />
              ))}
            </SortableContext>
          </tr>
        ))}
      </DndContext>
    </thead>

    {/* Row DnD: vertical */}
    <DndContext
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleRowDragEnd}
      sensors={sensors}
    >
      <tbody className="divide-y divide-gray-100 bg-white">
        {paddingTop > 0 && (
          <tr>
            <td style={{ height: `${paddingTop}px` }} colSpan={table.getVisibleLeafColumns().length} />
          </tr>
        )}

        {isLoading ? (
          <SortableContext items={[]} strategy={verticalListSortingStrategy}>
            {virtualItems.map((virtualRow) => (
              <tr key={virtualRow.key} className="h-[45px]">
                {table.getVisibleLeafColumns().map(col => (
                  <td key={col.id} className="py-2.5 px-3">
                    <div className="h-4 animate-pulse rounded bg-gray-100" />
                  </td>
                ))}
              </tr>
            ))}
          </SortableContext>
        ) : rows.length === 0 ? (
          <tr>
            <td
              colSpan={table.getVisibleLeafColumns().length}
              className="px-3 py-12 text-center text-sm text-gray-400"
            >
              {t('grid.noPlayers')}
            </td>
          </tr>
        ) : (
          <SortableContext
            items={rows.map(r => r.original.id)}
            strategy={verticalListSortingStrategy}
          >
            {virtualItems.map(virtualRow => {
              const row = rows[virtualRow.index] as Row<Player>
              return (
                <SortableRow
                  key={row.id}
                  row={row}
                  isDndDisabled={sorting.length > 0}
                />
              )
            })}
          </SortableContext>
        )}

        {paddingBottom > 0 && (
          <tr>
            <td style={{ height: `${paddingBottom}px` }} colSpan={table.getVisibleLeafColumns().length} />
          </tr>
        )}
      </tbody>
    </DndContext>
  </table>
</div>
```

- [ ] **Step 6E.2: Verify TypeScript compiles**

```bash
cd /Users/avivporze/Desktop/Programming/Scout && npx tsc --noEmit
```
Expected: no errors.

### Step 6F: Final visual verification

- [ ] **Step 6F.1: Start the dev server and run through the full checklist**

```bash
npm run dev
```

Check each item:

1. **Drag handle column visible:** Narrow column with grip icon appears on the left of every row when no sort is active.
2. **Row drag works:** Grab the grip, drag a row up or down, release. Row moves to the new position immediately (optimistic update).
3. **Sort disables handles:** Click any column header to sort. Grip icons disappear. Sort works normally.
4. **Sort clear restores custom order:** Click the sorted header again until the sort indicator clears (`ArrowUpDown` icon). Rows return to your manually dragged order.
5. **Column drag still works:** Drag column headers left/right. Still works independently.
6. **Drag column is not in visibility picker:** Open the Columns dropdown. `drag` column is not listed.
7. **Drag column cannot be moved:** Attempt to drag the grip header (`''` header). Nothing happens.
8. **Flags show correctly:** Nationality and league cells display the correct country flag.
9. **Unknown nationality/league:** A player with a nationality not in `TM_COUNTRY_ISO` shows only the text, no broken icon.

- [ ] **Step 6F.2: Commit**

```bash
git add src/components/table/MasterGrid.tsx
git commit -m "feat(ui): add persistent row drag-and-drop reordering to Master Grid"
```

---

## Task 7: DB Persistence Verification

- [ ] **Step 7.1: Verify sort_order persists after reload**

1. In the Master Grid, drag a player to a new position.
2. Wait 500ms (let the debounce fire).
3. Hard-refresh the page (Cmd+Shift+R).
4. Expected: the player is still in the dragged position.

- [ ] **Step 7.2: Verify new player appends to bottom**

1. Add a new player via the form or extension.
2. Return to the Master Grid (with no active sort).
3. Expected: the new player appears at the bottom of the list.

- [ ] **Step 7.3: Verify RLS — scout cannot reorder another user's players**

In Supabase Dashboard → SQL Editor, run:
```sql
-- Confirm no player's sort_order was changed for a user_id that isn't the current auth user
-- (This is guaranteed by the UPDATE policy but good to verify after testing)
SELECT added_by, COUNT(*) as count, MIN(sort_order), MAX(sort_order)
FROM players
GROUP BY added_by
ORDER BY added_by;
```
Expected: each user's sort_order values form a contiguous range with no gaps introduced by another user's session.

- [ ] **Step 7.4: Final commit tag**

```bash
git add -A
git status  # confirm only expected files changed
git commit -m "feat: complete flags, row DnD, and sort_order persistence" --allow-empty-if-nothing-staged
```

---

## Self-Review

**Spec coverage:**
- ✅ FlagCDN via `<img>` with `onError` fallback
- ✅ `TM_COUNTRY_ISO` and `LEAGUE_ISO` lookup maps in `countryIso.ts`
- ✅ Flags on `nationality` and `league` columns
- ✅ `sort_order` migration with per-user initialisation
- ✅ `getPlayers()` order changed to `sort_order ASC`
- ✅ New players appended via `MAX(sort_order) + 1`
- ✅ `bulkUpdateSortOrder` with `Promise.all`
- ✅ Debounced 400ms save
- ✅ Row DnD via `@dnd-kit/sortable` vertical strategy
- ✅ Handles hidden when any sort is active
- ✅ Sort cleared → returns to `sort_order ASC` (custom order)
- ✅ `drag` column: not in visibility picker, not movable, prepended
- ✅ Column DnD: renamed handler, `drag` column guarded
- ✅ `columnOrder` localStorage migration (prepends `drag` to old saved orders)
- ✅ RLS: no new policies; existing UPDATE policy covers `sort_order`
- ✅ Activity log: not affected (trigger doesn't watch `sort_order`)
- ✅ No `fbref_url` or `weight_kg` touched
