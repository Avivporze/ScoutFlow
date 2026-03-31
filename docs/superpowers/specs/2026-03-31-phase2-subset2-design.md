# Phase 2 Subset 2 — Player Form Page, Detail Panel, Social Links, Realtime

**Date:** 2026-03-31
**Status:** Approved
**Scope:** PlayerFormPage (full-page routes), PlayerDetailPanel (slide-out), SocialLinksDisplay,
useRealtimeSync, sidebar active highlight, toast system, routing wiring

---

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Form presentation | Full-page routes (`/players/new`, `/players/:id/edit`) | Matches reference UI; better for long scrolling form; "← Back" navigation |
| Internal section | 5th card "INTERNAL SCOUTING" | Best Fit Team + Status need to live in the form |
| Social platforms | Instagram + YouTube only | Lean, football-scouting focused |
| Toast library | `sonner` | Lightweight, zero-config, industry standard |
| Detail panel | Slide-out from right (no URL change) | Non-destructive; grid stays visible behind it |

---

## 1. Routes Added (`App.tsx`)

| Route | Component | Mode |
|---|---|---|
| `/players/new` | `PlayerFormPage` | Create — blank form |
| `/players/:id/edit` | `PlayerFormPage` | Edit — pre-filled from `usePlayers` cache |

No extra fetch needed in edit mode; player data is already in the TanStack Query cache from the grid.

---

## 2. TypeScript: SocialLinks Update (`src/types/player.ts`)

Trim `SocialLinks` to only the retained platforms:

```ts
export interface SocialLinks {
  instagram?: string
  youtube?: string
}
```

**Removed:** `twitter`, `facebook`, `tiktok`, `linkedin`, `website`.

---

## 3. PlayerFormPage (`src/pages/PlayerFormPage.tsx`)

### Page Structure

```
← Back                               [Save Player]
Edit Player  /  Add Player

[BASIC INFO card]
[CLUB & POSITION card]
[AGENT card]
[LINKS & SOCIAL card]
[INTERNAL SCOUTING card]
```

### Card Styling

- Container: `bg-white border border-gray-200 rounded-lg p-6`
- Section header: `text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4`
- Field grid: `grid grid-cols-2 gap-4` (full-width fields span both columns with `col-span-2`)

### Section 1 — BASIC INFO

| Col 1 | Col 2 |
|---|---|
| First Name* (text, required) | Last Name* (text, required) |
| Date of Birth (date input) | Nationality (text) |
| Second Nationality (text) | Preferred Foot (select: Left / Right / Both) |
| Height (cm) (number) | Weight (kg) (number) |

### Section 2 — CLUB & POSITION

| Col 1 | Col 2 |
|---|---|
| Current Club (text) | League (text) |
| Position (select: GK CB LB RB LWB RWB CDM CM CAM LM RM LW RW CF ST) | Contract Expiry (date input) |
| Market Value (text, e.g. "€5M") — full width | |

### Section 3 — AGENT

| Col 1 | Col 2 |
|---|---|
| Agent Name (text) | Agent Contact (text) |

### Section 4 — LINKS & SOCIAL

| Layout | Field |
|---|---|
| Full width | FBref URL (url input) |
| Full width | Transfermarkt URL (url input) |
| Col 1 | Instagram (url input) |
| Col 2 | YouTube (url input) |

**Note:** FBref URL is the field the Python scraper reads to know which players to fetch stats for.
It must be editable here so scouts can enable scraping for a player.

### Section 5 — INTERNAL SCOUTING

| Col 1 | Col 2 |
|---|---|
| Best Fit Team (select from `internal_teams`) | Status (select: Active / Watchlist / Archived) |

### Validation (on submit only)

- `first_name` and `last_name`: required — inline red error text below the field on failure
- URL fields (FBref, Transfermarkt, Instagram, YouTube): if non-empty, must start with `http://` or `https://`

### social_links JSONB Handling

State holds two separate string fields: `instagram`, `youtube`.

On submit, build the JSONB object including only non-empty trimmed values:
```ts
const social_links = Object.fromEntries(
  Object.entries({ instagram, youtube }).filter(([, v]) => v?.trim())
)
```

In edit mode: explode `player.social_links` (cast to `SocialLinks`) into individual fields on mount.

### Submission Flow

- **Create:** `addPlayer(payload)` → `toast.success(t('toast.playerAdded'))` → `navigate('/players')`
- **Edit:** `updatePlayer(id, payload)` → `toast.success(t('toast.playerUpdated'))` → `navigate('/players')`
- **Error:** `toast.error(t('toast.error'))`, stay on page

### What Is NOT In This Form

`stats_matches`, `stats_goals`, `stats_assists`, `stats_minutes`, `stats_updated_at` are never present.
These are owned exclusively by the Python FBref scraper and shown read-only elsewhere.

---

## 4. PlayerDetailPanel (`src/components/players/PlayerDetailPanel.tsx`)

### Presentation

`fixed inset-y-0 right-0 w-[480px]` white panel with `shadow-xl`. A semi-transparent backdrop
(`fixed inset-0 bg-black/20`) sits behind the panel; clicking it closes the panel. No URL change.

### Contents (top to bottom)

1. **Header bar:** player full name (bold, large), close button (X icon, top-right)
2. **Action row:**
   - Edit button → `navigate('/players/:id/edit')`
   - Archive button (secondary) — calls `updatePlayer(id, { status: 'archived' })`
   - Delete button (danger) — visible only when `profile.role === 'admin'`
3. **Stats card:** `<PlayerStatsCard player={player} />` (read-only)
4. **Profile sections** (read-only display labels + values, grouped same as form):
   - **Basic Info:** age (computed from DOB), nationality, second nationality, preferred foot, height, weight
   - **Club & Position:** current club, league, position, contract expiry, market value
   - **Agent:** agent name, agent contact
   - **Links & Social:** FBref link button (external `<a>`), Transfermarkt link button (external `<a>`),
     `<SocialLinksDisplay links={player.social_links as SocialLinks} />`
   - **Internal Scouting:** best fit team name (resolved from `teamsMap`), status badge
5. **Notes placeholder:** `bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-400`
   — "Notes thread coming in Phase 3"

### Action Behavior

- **Archive:** `updatePlayer(id, { status: 'archived' })` → `toast.success(t('toast.playerArchived'))` → close panel
- **Delete:** `window.confirm(t('detail.confirmDelete'))` → `deletePlayer(id)` → `toast.success(t('toast.playerDeleted'))` → close panel

---

## 5. SocialLinksDisplay (`src/components/players/SocialLinksDisplay.tsx`)

**Props:** `links: SocialLinks`

Renders only platforms with a non-empty value as `<a href target="_blank" rel="noopener noreferrer">` links.
Layout: horizontal flex row, icons styled `text-gray-500 hover:text-blue-600`.

| Platform | Lucide Icon |
|---|---|
| `instagram` | `Instagram` |
| `youtube` | `Youtube` |

Returns `null` if both platforms are empty.

---

## 6. useRealtimeSync (`src/hooks/useRealtimeSync.ts`)

Called once in `MasterGridPage`. Subscribes to `postgres_changes` on the `players` table for all
events (INSERT, UPDATE, DELETE). On any event: invalidates `['players']` query cache, causing the
MasterGrid to refetch and display the latest data. Cleans up the Supabase channel on unmount.

```ts
// Conceptual shape:
const channel = supabase
  .channel('players-changes')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, () => {
    queryClient.invalidateQueries({ queryKey: ['players'] })
  })
  .subscribe()
```

---

## 7. Toast System

**Library:** `sonner` (add to `package.json`).
**Setup:** Add `<Toaster />` once in `App.tsx` (outside the router, at the root level).
**Usage:** `toast.success(message)` / `toast.error(message)` from form handlers and panel actions.

---

## 8. Sidebar Active Highlight (`src/components/layout/Sidebar.tsx`)

Update nav links to use `<NavLink>` from React Router v6. Apply:
- Active item: `bg-gray-100 text-gray-900`
- All items hover: `hover:bg-gray-50`

Matches the subtle soft-highlight visible in reference Image 1 (Dashboard active state).

---

## 9. MasterGrid Wiring (`src/components/table/MasterGrid.tsx`)

- **Add Player button:** Replace the current `disabled` button with a styled `<Link to="/players/new">`
- **Player name click:** `PlayerNameCell` receives an `onPlayerClick: (player: Player) => void` callback.
  `MasterGrid` owns `selectedPlayer: Player | null` state and renders `<PlayerDetailPanel>` when non-null.
- **Realtime:** `MasterGridPage` calls `useRealtimeSync()` at the top level.

---

## 10. constants.ts (`src/lib/constants.ts`)

New file with static lookup lists used by the form:

```ts
export const POSITIONS = [
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'LW', 'RW', 'CF', 'ST',
] as const

export const PREFERRED_FOOT_OPTIONS = ['Left', 'Right', 'Both'] as const

export const PLAYER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'archived', label: 'Archived' },
] as const
```

---

## 11. i18n Additions (`en.json` / `es.json`)

```json
"playerForm": {
  "addTitle": "Add Player",
  "editTitle": "Edit Player",
  "savePlayer": "Save Player",
  "back": "← Back",
  "sections": {
    "basicInfo": "Basic Info",
    "clubPosition": "Club & Position",
    "agent": "Agent",
    "linksSocial": "Links & Social",
    "internal": "Internal Scouting"
  },
  "fields": {
    "firstName": "First Name",
    "lastName": "Last Name",
    "dateOfBirth": "Date of Birth",
    "nationality": "Nationality",
    "secondNationality": "Second Nationality",
    "preferredFoot": "Preferred Foot",
    "heightCm": "Height (cm)",
    "weightKg": "Weight (kg)",
    "currentClub": "Current Club",
    "league": "League",
    "position": "Position",
    "contractExpiry": "Contract Expiry",
    "marketValue": "Market Value",
    "agentName": "Agent Name",
    "agentContact": "Agent Contact",
    "fbrefUrl": "FBref URL",
    "transfermarktUrl": "Transfermarkt URL",
    "instagram": "Instagram",
    "youtube": "YouTube",
    "bestFitTeam": "Best Fit Team",
    "status": "Status",
    "noTeam": "No team assigned"
  },
  "errors": {
    "required": "This field is required",
    "invalidUrl": "Must be a valid URL (https://...)"
  }
},
"detail": {
  "edit": "Edit",
  "archive": "Archive",
  "delete": "Delete",
  "confirmDelete": "Delete this player? This cannot be undone.",
  "notesPlaceholder": "Notes thread coming in Phase 3",
  "externalLinks": "External Profiles",
  "noValue": "—"
},
"toast": {
  "playerAdded": "Player added",
  "playerUpdated": "Player updated",
  "playerArchived": "Player archived",
  "playerDeleted": "Player deleted",
  "error": "Something went wrong. Please try again."
}
```

---

## Files Created / Modified

| Action | File |
|---|---|
| **New** | `src/pages/PlayerFormPage.tsx` |
| **New** | `src/components/players/PlayerDetailPanel.tsx` |
| **New** | `src/components/players/SocialLinksDisplay.tsx` |
| **New** | `src/hooks/useRealtimeSync.ts` |
| **New** | `src/lib/constants.ts` |
| **Modified** | `src/types/player.ts` — trim SocialLinks to instagram + youtube |
| **Modified** | `src/App.tsx` — add 2 routes + `<Toaster />` |
| **Modified** | `src/components/table/MasterGrid.tsx` — Add Player link, selectedPlayer state, detail panel |
| **Modified** | `src/components/table/cells/PlayerNameCell.tsx` — onPlayerClick callback |
| **Modified** | `src/components/layout/Sidebar.tsx` — NavLink active highlight |
| **Modified** | `src/pages/MasterGridPage.tsx` — call useRealtimeSync |
| **Modified** | `src/i18n/en.json` + `es.json` — new keys |

---

## Acceptance Criteria

- [ ] `/players/new` opens blank form; save adds player with success toast, redirects to `/players`
- [ ] `/players/:id/edit` opens pre-filled form; save updates with success toast, redirects to `/players`
- [ ] Form contains zero `stats_*` fields
- [ ] LINKS & SOCIAL shows only FBref URL, Transfermarkt URL, Instagram, YouTube — nothing else
- [ ] `SocialLinks` type has only `instagram` and `youtube` (TypeScript build fails if others referenced)
- [ ] Clicking a player name opens the slide-out detail panel
- [ ] Detail panel shows PlayerStatsCard (read-only), SocialLinksDisplay, external link buttons, notes placeholder
- [ ] Archive action updates status and shows toast; Delete is admin-only with confirmation
- [ ] Two open tabs: grid in one refreshes automatically when a player is edited in the other (Realtime)
- [ ] Sidebar active item has subtle background highlight matching reference image
- [ ] `npm run build` with zero TypeScript errors
