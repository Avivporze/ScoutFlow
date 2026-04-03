# Dashboard Cleanup & Security Hardening — Design Spec

**Date:** 2026-04-04
**Status:** Approved
**Scope:** Post-MVP audit remediation — dead code removal, RLS scoping, i18n cleanup

---

## Background

Following the MVP and dashboard refactoring, a security and dead-code audit identified three categories of issues:

1. The `activity_log` feed was unscoped (showed all users' activity), conflicting with ScoutFlow's design as a personal scouting tool.
2. Deleting `DepthPipelineWidget` and `RecentProspectsWidget` left orphaned backend functions, hooks, and types in place.
3. Six i18n keys that belonged to the removed widgets remained in both language files.

No security vulnerabilities were found. The Supabase client correctly uses only the anon key. The TypeScript build was clean. These are UX correctness and code hygiene fixes.

---

## Section 1 — Activity Feed RLS Scoping

**File:** `src/api/dashboard.ts` → `getRecentActivity()`

**Change:** Resolve the current user via `supabase.auth.getUser()` and add `.eq('user_id', userId)` to the query before the limit. If no authenticated user is found, return an empty array immediately without executing the query.

**Why this approach:** Consistent with the `addPlayer` pattern already used in `players.ts`. Keeps the filter logic inside the API layer; no changes needed in the hook (`useDashboard.ts`) or component (`DashboardPage.tsx`).

**UX implication (confirmed by Tech Lead):** The Dashboard activity feed will show only the current user's own actions. ScoutFlow is a personal tool, not a collaborative team platform.

---

## Section 2 — Dead Code Deletion

### `src/api/dashboard.ts`

Remove the following, which were left behind when `DepthPipelineWidget` and `RecentProspectsWidget` were deleted:

| Item | Lines | Reason |
|---|---|---|
| `RecentProspect` type | line 21 | No consumer |
| `watchlistCount` field in `DashboardStats` | line 7 | Never read in UI |
| `watchlistResult` query in `getDashboardStats` | lines 57–58 | Feeds orphaned field |
| `watchlistCount` in return object | line 89 | Feeds orphaned field |
| `getRecentProspects()` function | lines 118–128 | No consumer |
| `getPositionalPipeline()` function | lines 212–233 | No consumer |

The `Promise.all` in `getDashboardStats` drops from 4 parallel queries to 3.

### `src/hooks/useDashboard.ts`

| Item | Lines | Reason |
|---|---|---|
| `usePositionalPipeline()` hook | lines 70–82 | Never imported anywhere |
| `useRecentProspects()` hook | lines 84–96 | Never imported anywhere |
| Imports: `getPositionalPipeline`, `getRecentProspects` | lines 7–8 | Now unused |

**Not touched:** `useTopPerformers`, `useExpiringContracts`, `useHighestMarketValue`, `useScoutingGaps`, `useScoutingGapCount`, `useDashboardStats`, `useRecentActivity` — all actively used by the 4 approved widgets.

---

## Section 3 — i18n Cleanup

Remove these 6 keys from the `dashboard` namespace in **both** `src/i18n/en.json` and `src/i18n/es.json`:

| Key | Was used by |
|---|---|
| `pipeline` | `DepthPipelineWidget` (deleted) |
| `recentlyAdded` | `RecentProspectsWidget` (deleted) |
| `age` | Recent prospects list (deleted) |
| `watchlistCount` | Watchlist stat card (removed from UI) |
| `noScoutingGaps` | Scouting gaps empty state (never rendered) |
| `noNotesYet` | Scouting gaps notes display (never rendered) |

All other dashboard keys remain untouched.

---

## Section 4 — Verification

After all changes:
1. Run `npx tsc --noEmit` — must return zero errors.
2. Confirm the 4 active widgets still have all their required hooks and API functions.
3. Confirm no i18n key used in active components was removed.

---

## Safety Guarantee

The 4 active dashboard widgets are fully isolated from all deleted items:

| Widget | Hooks used | API functions used |
|---|---|---|
| TopPerformersWidget | `useTopPerformers` | `getTopPerformers` |
| ExpiringContractsWidget | `useExpiringContracts` | `getExpiringContracts` |
| HighestMarketValueWidget | `useHighestMarketValue` | `getHighestMarketValue` |
| ScoutingGapsStatWidget | `useScoutingGapCount` | `getScoutingGapCount` |

None of these depend on `getRecentProspects`, `getPositionalPipeline`, `watchlistCount`, or any of the 6 orphaned i18n keys.
