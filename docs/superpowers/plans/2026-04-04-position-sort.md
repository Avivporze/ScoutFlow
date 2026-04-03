# Position Column Custom Sort — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hierarchical position sort (Attackers → Midfielders → Defenders → GK) to the Position column in MasterGrid, triggered only when the user clicks that column header.

**Architecture:** A new standalone utility `src/lib/positionSort.ts` exports a weight map, a helper, and a TanStack Table `SortingFn<Player>`. The position column accessor in `columns.tsx` gains a single `sortingFn` property pointing to it. No changes to `MasterGrid.tsx`.

**Tech Stack:** TypeScript, React, TanStack Table v8 (`@tanstack/react-table`)

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/lib/positionSort.ts` | Weight map, `getPositionWeight`, `positionSortingFn` |
| Modify | `src/components/table/columns.tsx` | Import + attach `sortingFn` to position column |

---

### Task 1: Create `src/lib/positionSort.ts`

**Files:**
- Create: `src/lib/positionSort.ts`

- [ ] **Step 1: Write the file**

Create `src/lib/positionSort.ts` with this exact content:

```ts
import type { SortingFn } from '@tanstack/react-table'
import type { Player } from '@/types/player'

/**
 * Hierarchical position sort weights.
 * Lower weight = closer to top when sorted ascending.
 *
 * 1 = Attackers  (LW, RW, CF, ST)
 * 2 = Midfielders (CDM, CM, CAM, LM, RM)
 * 3 = Defenders  (CB, LB, RB, LWB, RWB)
 * 4 = Goalkeeper (GK)
 * 5 = Unknown / null (always sinks to bottom)
 */
export const POSITION_WEIGHT: Record<string, number> = {
  // Attackers
  LW: 1, RW: 1, CF: 1, ST: 1,
  // Midfielders
  CDM: 2, CM: 2, CAM: 2, LM: 2, RM: 2,
  // Defenders
  CB: 3, LB: 3, RB: 3, LWB: 3, RWB: 3,
  // Goalkeeper
  GK: 4,
}

export function getPositionWeight(position: string | null): number {
  return position != null ? (POSITION_WEIGHT[position] ?? 5) : 5
}

export const positionSortingFn: SortingFn<Player> = (rowA, rowB) => {
  return getPositionWeight(rowA.original.position) - getPositionWeight(rowB.original.position)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see "Cannot find module '@/types/player'" verify `tsconfig.json` has `paths: { "@/*": ["./src/*"] }` — it does, as this alias is used throughout the codebase.

---

### Task 2: Attach `positionSortingFn` to the position column

**Files:**
- Modify: `src/components/table/columns.tsx` (line ~119)

- [ ] **Step 1: Add the import**

At the top of `src/components/table/columns.tsx`, after the existing imports, add:

```ts
import { positionSortingFn } from '@/lib/positionSort'
```

- [ ] **Step 2: Add `sortingFn` to the position column accessor**

Find this block (around line 119):

```ts
    col.accessor('position', {
      header: t('columnHeaders.position'),
      cell: info => <PositionBadge position={info.getValue()} />,
    }),
```

Replace it with:

```ts
    col.accessor('position', {
      header: t('columnHeaders.position'),
      cell: info => <PositionBadge position={info.getValue()} />,
      sortingFn: positionSortingFn,
    }),
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors. `SortingFn<Player>` is compatible with TanStack Table's column `sortingFn` property — it accepts a `SortingFn<TData>` directly (not just a string name).

- [ ] **Step 4: Run the dev server and smoke-test**

```bash
npm run dev
```

Open the app → Master Grid → click the **Position** column header once.
Expected: rows reorder with Attackers (LW, RW, CF, ST) at the top, GK at the bottom.
Click again → Descending: GK at top, Attackers at bottom.
Drag a row while a sort is active → grip handle should be hidden/disabled (existing behaviour — `isDndDisabled={sorting.length > 0}` is already in place).
Click the column header a third time → sort clears, row DnD re-enables.

- [ ] **Step 5: Commit**

```bash
git add src/lib/positionSort.ts src/components/table/columns.tsx
git commit -m "feat: add hierarchical position sort (Attackers → GK)"
```

---

## Self-Review

**Spec coverage:**
- ✅ Custom sort on Position column only
- ✅ Ascending = Attackers first, GK last
- ✅ Descending = reversed
- ✅ DnD sort order unaffected (existing guard `isDndDisabled={sorting.length > 0}` unchanged)
- ✅ i18n unaffected (no changes to translation keys or `t()` calls)
- ✅ TypeScript strict (no `any`, null handled, `SortingFn<Player>` typed)

**Placeholder scan:** None found.

**Type consistency:** `positionSortingFn: SortingFn<Player>` defined in Task 1, imported and used as `sortingFn: positionSortingFn` in Task 2. Matches throughout.
