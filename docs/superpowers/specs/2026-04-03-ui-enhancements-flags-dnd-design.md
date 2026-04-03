# Design Spec: UI Enhancements — Flags, Row DnD, Sort Persistence

**Date:** 2026-04-03
**Status:** Approved
**Scope:** ScoutFlow Master Grid and supporting data layer

---

## 1. Country Flags

### Goal
Display a small country flag inline next to:
- `nationality` column value
- `league` column value (flag of the country the league belongs to)

### Approved Approach: FlagCDN via `<img>`

**Rendering:**
```tsx
<img
  src={`https://flagcdn.com/w20/${iso}.png`}
  onError={(e) => { e.currentTarget.style.display = 'none' }}
  className="inline w-4 h-3 mr-1 rounded-sm align-middle"
/>
```

**ISO Mapping:** A single shared module `src/lib/countryIso.ts` exports two lookup objects:
- `TM_COUNTRY_ISO: Record<string, string>` — maps TM full English country names (as stored in `nationality`) to ISO-2 codes
- `LEAGUE_ISO: Record<string, string>` — maps league name strings (as stored in `league`) to ISO-2 codes (~30–50 entries)

Both are static `Record<string, string>` objects with no runtime dependencies. A missing key renders the text only (no broken image).

**Component change:** Both the `nationality` and `league` columns in `src/components/table/columns.tsx` have their `cell` renderers updated to prepend the flag image. No new component file is needed — the flag is inline JSX in the column definition.

**Bundle impact:** 0 KB.

---

## 2. Persistent Row Reordering (Drag & Drop)

### Goal
Allow manual reordering of players in the Master Grid by dragging rows. The order is saved to the database and is the default view.

### Approved Approach: Extend existing @dnd-kit

**No new dependencies.** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` are already installed.

### Interaction Model
- **Default state (no active sort):** DnD handles are visible on each row. Row order reflects `sort_order ASC` from the database. Dragging a row updates `sort_order` for all affected rows.
- **Sort active (user clicked a header):** DnD handles are hidden (`sorting.length > 0`). Rows display in the sort-derived order. `sort_order` DB values are not read or written while a sort is active.
- **Sort cleared:** Grid returns to `sort_order ASC` — the saved custom order. This is the source of truth for the default view.

### Component Changes (`MasterGrid.tsx`)
1. Wrap `<tbody>` rows with a vertical `SortableContext` (separate from the existing horizontal column `SortableContext`).
2. Each `<tr>` uses `useSortable({ id: row.original.id })`.
3. A non-data column `drag` is prepended to the column list (not part of `buildColumns`, defined directly in MasterGrid). It renders a `GripVertical` icon as the drag handle for each row. The column has no header text, fixed width (~32px), is not sortable, and is not toggleable in the column visibility picker. It is hidden (`display: none`) when `sorting.length > 0`.
4. `handleRowDragEnd`: calls `arrayMove` on the local player order state, then triggers the debounced DB write.

### Data Flow
```
Drag end
  → arrayMove(localOrder, oldIdx, newIdx)
  → recompute sort_order (index 0, 1, 2…)
  → debounce 400ms
  → Promise.all(players.map(p => updatePlayer(p.id, { sort_order: i })))
  → React Query invalidate ['players']
```

**Optimistic UI:** The local order array is updated immediately on drag end (before DB write). If the DB write fails, React Query re-fetch restores correct order.

### New Player Order
When `addPlayer()` is called (from extension or form), `sort_order` is set to `currentMaxSortOrder + 1`, appending the new player to the bottom of the custom order.

---

## 3. Database: `sort_order` Column

### Migration: `006_add_player_sort_order.sql`

```sql
ALTER TABLE players
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

-- Initialize per-user sequential order based on creation date
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY added_by ORDER BY created_at) AS rn
  FROM players
)
UPDATE players
SET sort_order = ordered.rn
FROM ordered
WHERE players.id = ordered.id;

CREATE INDEX idx_players_sort_order ON players (added_by, sort_order);
```

### RLS: No new policies needed
The existing UPDATE policy `USING (added_by = auth.uid() OR is_admin())` covers `sort_order` updates. Users can only reorder their own players.

### Query change in `getPlayers()`
```ts
// Before: .order('created_at', { ascending: false })
// After:  .order('sort_order', { ascending: true })
```

### Activity Log: No impact
`log_player_updated()` trigger does not watch `sort_order`. Bulk reorder writes produce no activity log entries.

---

## 4. Security & Integrity Constraints

- No `fbref_url` or `weight_kg` fields are touched by any change in this spec.
- All DB mutations go through the existing `updatePlayer()` function, which respects RLS.
- Flag rendering is purely read-only; no data is written based on flag display.
- The `TM_COUNTRY_ISO` and `LEAGUE_ISO` mappings are static — no network call, no injection surface.

---

## 5. Files to Create/Modify

| File | Action |
|---|---|
| `supabase/migrations/006_add_player_sort_order.sql` | New — adds `sort_order` column |
| `src/lib/countryIso.ts` | New — `TM_COUNTRY_ISO` and `LEAGUE_ISO` maps |
| `src/types/database.ts` | Edit — add `sort_order: number` to players Row/Insert/Update |
| `src/api/players.ts` | Edit — change `getPlayers()` order; add sort_order to `addPlayer()` logic |
| `src/components/table/columns.tsx` | Edit — add flag rendering to `nationality` and `league` cells |
| `src/components/table/MasterGrid.tsx` | Edit — add vertical row DnD; debounced bulk update; handle/sort interaction |
