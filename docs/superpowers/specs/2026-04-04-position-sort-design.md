# Position Column Custom Sort — Design Spec

**Date:** 2026-04-04
**Status:** Approved

---

## Problem

Sorting the Position column alphabetically produces nonsensical results for football scouting (e.g., CAM before CB, GK before LB). The correct sort is a football-pitch hierarchy: Attackers → Midfielders → Defenders → Goalkeepers.

---

## Scope

- Custom hierarchical sort on the Position column only.
- Ascending (first click): Attackers at top, Goalkeepers at bottom.
- Descending (second click): reversed.
- No changes to row DnD sort order, i18n, or any other column.

---

## Position Data Format

Positions are stored as short abbreviations (`string | null`) defined in `src/lib/constants.ts`:

```ts
export const POSITIONS = [
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'LW', 'RW', 'CF', 'ST',
] as const
```

The DB column is `position: string | null`. No full Transfermarkt names are stored.

---

## Approach: Dedicated Utility (Approach B)

### New file: `src/lib/positionSort.ts`

**Exports:**

1. `POSITION_WEIGHT: Record<string, number>` — maps each abbreviation to a numeric group weight:

   | Weight | Positions |
   |--------|-----------|
   | 1 | LW, RW, CF, ST (Attackers) |
   | 2 | CDM, CM, CAM, LM, RM (Midfielders) |
   | 3 | CB, LB, RB, LWB, RWB (Defenders) |
   | 4 | GK (Goalkeeper) |
   | 5 | null / unknown (sinks to bottom in both directions) |

2. `getPositionWeight(position: string | null): number` — pure function, returns the weight for a given position string.

3. `positionSortingFn: SortingFn<Player>` — TanStack Table-compatible comparator. Compares two rows by their `position` weight. Ascending = lower weight first = Attackers first.

### Change in `src/components/table/columns.tsx`

- Import `positionSortingFn` from `@/lib/positionSort`.
- Add `sortingFn: positionSortingFn` to the `position` column accessor. One line change.

### No changes to `MasterGrid.tsx`

DnD is already disabled when `sorting.length > 0` (`isDndDisabled={sorting.length > 0}` on `SortableRow`). This correctly disables row drag when any column sort is active, including the position sort.

---

## TypeScript Constraints

- `positionSortingFn` is typed as `SortingFn<Player>` from `@tanstack/react-table`.
- `POSITION_WEIGHT` keys are `string` (not `typeof POSITIONS[number]`) so the map accepts unknown positions gracefully without a TS error — unknown keys fall back to weight 5 via the `?? 5` pattern in `getPositionWeight`.
- `position` accessed as `row.original.position` (`string | null`) — null handled explicitly.

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/positionSort.ts` | New — weight map, helper, sorting function |
| `src/components/table/columns.tsx` | Add `sortingFn` to `position` column |

---

## Out of Scope

- Sub-group ordering within a line (e.g., ST vs CF) — weight is group-level only; ties resolve by stable row order.
- Persisting the sort preference across sessions.
- Filtering players by position group.
