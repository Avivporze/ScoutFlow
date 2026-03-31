# Phase 2 Subset 2 — Player Form, Detail Panel, Social Links, Realtime

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full player add/edit form page, slide-out detail panel, social links display, and Supabase Realtime sync so scouts can create and edit players and see live updates across tabs.

**Architecture:** The form lives at dedicated routes (`/players/new`, `/players/:id/edit`) as a scrolling single-page layout with 5 card sections. The detail panel is a `fixed` slide-out overlay that does not change the URL. Realtime sync invalidates the TanStack Query cache on any players table change.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, TanStack Query v5, React Router v6, Supabase Realtime, sonner (toasts), Lucide React icons, react-i18next

---

## Pre-flight Notes

- **Sidebar:** Already uses `<NavLink>` with `bg-blue-50 text-blue-600` active styles — no changes needed.
- **No test framework** exists in this project. Verification is `npm run build` (TypeScript compilation) after each task, plus manual browser smoke tests noted at the end.
- **Stats fields** (`stats_matches`, `stats_goals`, `stats_assists`, `stats_minutes`, `stats_updated_at`) must never appear in the form. They are scraper-owned and shown read-only elsewhere.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/types/player.ts` | Trim `SocialLinks` to `instagram` + `youtube` only |
| Create | `src/lib/constants.ts` | POSITIONS list, foot options, status options |
| Modify | `src/i18n/en.json` | Add `playerForm`, `detail`, `toast` keys |
| Modify | `src/i18n/es.json` | Same keys in Spanish |
| Create | `src/components/players/SocialLinksDisplay.tsx` | Icon links for instagram/youtube |
| Create | `src/hooks/useRealtimeSync.ts` | Supabase Realtime subscription → cache invalidation |
| Modify | `src/components/table/cells/PlayerNameCell.tsx` | Make name clickable (button + onClick prop) |
| Modify | `src/components/table/columns.tsx` | Pass `onPlayerClick` into `buildColumns` |
| Create | `src/pages/PlayerFormPage.tsx` | Full scrolling add/edit form |
| Create | `src/components/players/PlayerDetailPanel.tsx` | Fixed right slide-out panel |
| Modify | `src/components/table/MasterGrid.tsx` | selectedPlayer state, Add Player link, render panel |
| Modify | `src/App.tsx` | Add `<Toaster>`, add `/players/new` and `/players/:id/edit` routes |
| Modify | `src/pages/MasterGridPage.tsx` | Call `useRealtimeSync()` |

---

## Task 1: Trim SocialLinks + Create constants.ts

**Files:**
- Modify: `src/types/player.ts`
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Update SocialLinks interface**

Replace the `SocialLinks` interface in `src/types/player.ts`. The full file becomes:

```ts
import type { Database } from './database'

export type Player = Database['public']['Tables']['players']['Row']
export type PlayerInsert = Database['public']['Tables']['players']['Insert']
export type PlayerUpdate = Database['public']['Tables']['players']['Update']

export interface SocialLinks {
  instagram?: string
  youtube?: string
}

export type PlayerWithSocial = Omit<Player, 'social_links'> & {
  social_links: SocialLinks
}

export type PlayerStats = Pick<
  Player,
  'stats_matches' | 'stats_goals' | 'stats_assists' | 'stats_minutes' | 'stats_updated_at'
>
```

- [ ] **Step 2: Create constants.ts**

Create `src/lib/constants.ts`:

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

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/player.ts src/lib/constants.ts
git commit -m "feat: trim SocialLinks to instagram+youtube, add constants"
```

---

## Task 2: Add i18n Keys

**Files:**
- Modify: `src/i18n/en.json`
- Modify: `src/i18n/es.json`

- [ ] **Step 1: Replace en.json**

Write `src/i18n/en.json` (preserves all existing keys, adds new sections):

```json
{
  "nav": {
    "dashboard": "Dashboard",
    "players": "Players",
    "filter": "Filter",
    "settings": "Settings"
  },
  "auth": {
    "loginTitle": "Sign in to Scout",
    "signupTitle": "Create your account",
    "email": "Email",
    "password": "Password",
    "fullName": "Full Name",
    "login": "Sign In",
    "signup": "Create Account",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "signupLink": "Sign up",
    "loginLink": "Sign in",
    "signOut": "Sign out"
  },
  "common": {
    "loading": "Loading…",
    "error": "An error occurred. Please try again.",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "add": "Add",
    "search": "Search",
    "noResults": "No results found."
  },
  "pages": {
    "dashboard": "Dashboard",
    "players": "Players",
    "filter": "Advanced Filter",
    "settings": "Settings"
  },
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
  },
  "playerForm": {
    "addTitle": "Add Player",
    "editTitle": "Edit Player",
    "savePlayer": "Save Player",
    "back": "Back",
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
    "noValue": "—"
  },
  "toast": {
    "playerAdded": "Player added",
    "playerUpdated": "Player updated",
    "playerArchived": "Player archived",
    "playerDeleted": "Player deleted",
    "error": "Something went wrong. Please try again."
  }
}
```

- [ ] **Step 2: Replace es.json**

Write `src/i18n/es.json` (preserves all existing keys, adds Spanish translations):

```json
{
  "nav": {
    "dashboard": "Panel",
    "players": "Jugadores",
    "filter": "Filtro",
    "settings": "Ajustes"
  },
  "auth": {
    "loginTitle": "Inicia sesión en Scout",
    "signupTitle": "Crea tu cuenta",
    "email": "Correo electrónico",
    "password": "Contraseña",
    "fullName": "Nombre completo",
    "login": "Iniciar sesión",
    "signup": "Crear cuenta",
    "noAccount": "¿No tienes cuenta?",
    "hasAccount": "¿Ya tienes cuenta?",
    "signupLink": "Regístrate",
    "loginLink": "Inicia sesión",
    "signOut": "Cerrar sesión"
  },
  "common": {
    "loading": "Cargando…",
    "error": "Ocurrió un error. Inténtalo de nuevo.",
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "add": "Añadir",
    "search": "Buscar",
    "noResults": "No se encontraron resultados."
  },
  "pages": {
    "dashboard": "Panel",
    "players": "Jugadores",
    "filter": "Filtro avanzado",
    "settings": "Ajustes"
  },
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
  },
  "playerForm": {
    "addTitle": "Añadir jugador",
    "editTitle": "Editar jugador",
    "savePlayer": "Guardar jugador",
    "back": "Volver",
    "sections": {
      "basicInfo": "Información básica",
      "clubPosition": "Club y posición",
      "agent": "Agente",
      "linksSocial": "Enlaces y redes sociales",
      "internal": "Scouting interno"
    },
    "fields": {
      "firstName": "Nombre",
      "lastName": "Apellido",
      "dateOfBirth": "Fecha de nacimiento",
      "nationality": "Nacionalidad",
      "secondNationality": "Segunda nacionalidad",
      "preferredFoot": "Pie preferido",
      "heightCm": "Altura (cm)",
      "weightKg": "Peso (kg)",
      "currentClub": "Club actual",
      "league": "Liga",
      "position": "Posición",
      "contractExpiry": "Vencimiento de contrato",
      "marketValue": "Valor de mercado",
      "agentName": "Nombre del agente",
      "agentContact": "Contacto del agente",
      "fbrefUrl": "URL de FBref",
      "transfermarktUrl": "URL de Transfermarkt",
      "instagram": "Instagram",
      "youtube": "YouTube",
      "bestFitTeam": "Equipo más adecuado",
      "status": "Estado",
      "noTeam": "Sin equipo asignado"
    },
    "errors": {
      "required": "Este campo es obligatorio",
      "invalidUrl": "Debe ser una URL válida (https://...)"
    }
  },
  "detail": {
    "edit": "Editar",
    "archive": "Archivar",
    "delete": "Eliminar",
    "confirmDelete": "¿Eliminar este jugador? Esta acción no se puede deshacer.",
    "notesPlaceholder": "Hilo de notas disponible en la Fase 3",
    "noValue": "—"
  },
  "toast": {
    "playerAdded": "Jugador añadido",
    "playerUpdated": "Jugador actualizado",
    "playerArchived": "Jugador archivado",
    "playerDeleted": "Jugador eliminado",
    "error": "Algo salió mal. Inténtalo de nuevo."
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.json src/i18n/es.json
git commit -m "feat: add i18n keys for player form, detail panel, and toasts"
```

---

## Task 3: Install Sonner + SocialLinksDisplay

**Files:**
- Create: `src/components/players/SocialLinksDisplay.tsx`

- [ ] **Step 1: Install sonner**

```bash
npm install sonner
```

Expected: `sonner` added to `package.json` dependencies, `package-lock.json` updated.

- [ ] **Step 2: Create SocialLinksDisplay**

Create `src/components/players/SocialLinksDisplay.tsx`:

```tsx
import { Instagram, Youtube } from 'lucide-react'
import type { SocialLinks } from '@/types/player'

interface Props {
  links: SocialLinks
}

const PLATFORMS = [
  { key: 'instagram' as const, Icon: Instagram, label: 'Instagram' },
  { key: 'youtube' as const, Icon: Youtube, label: 'YouTube' },
]

export function SocialLinksDisplay({ links }: Props) {
  const active = PLATFORMS.filter(({ key }) => links[key])
  if (active.length === 0) return null

  return (
    <div className="flex items-center gap-3">
      {active.map(({ key, Icon, label }) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="text-gray-500 transition-colors hover:text-blue-600"
        >
          <Icon size={20} />
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/players/SocialLinksDisplay.tsx
git commit -m "feat: install sonner, add SocialLinksDisplay component"
```

---

## Task 4: useRealtimeSync Hook

**Files:**
- Create: `src/hooks/useRealtimeSync.ts`

- [ ] **Step 1: Create the hook**

Create `src/hooks/useRealtimeSync.ts`:

```ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/api/supabase'

export function useRealtimeSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('players-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['players'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRealtimeSync.ts
git commit -m "feat: add useRealtimeSync hook for live player grid updates"
```

---

## Task 5: Make PlayerNameCell Clickable + Update columns.tsx

**Files:**
- Modify: `src/components/table/cells/PlayerNameCell.tsx`
- Modify: `src/components/table/columns.tsx`

- [ ] **Step 1: Update PlayerNameCell**

Replace `src/components/table/cells/PlayerNameCell.tsx` entirely:

```tsx
import type { Player } from '@/types/player'

interface Props {
  player: Player
  onClick: (player: Player) => void
}

export function PlayerNameCell({ player, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={() => onClick(player)}
      className="font-medium text-blue-600 hover:underline"
    >
      {player.first_name} {player.last_name}
    </button>
  )
}
```

- [ ] **Step 2: Update buildColumns signature in columns.tsx**

In `src/components/table/columns.tsx`, change line 68 and line 74:

Old line 68:
```tsx
export function buildColumns(teamsMap: Map<string, string>): ColumnDef<Player, unknown>[] {
```

New line 68:
```tsx
export function buildColumns(
  teamsMap: Map<string, string>,
  onPlayerClick: (player: Player) => void,
): ColumnDef<Player, unknown>[] {
```

Old line 74:
```tsx
      cell: info => <PlayerNameCell player={info.row.original} />,
```

New line 74:
```tsx
      cell: info => <PlayerNameCell player={info.row.original} onClick={onPlayerClick} />,
```

No other lines in `columns.tsx` change.

- [ ] **Step 3: Verify build**

```bash
npm run build
```

Expected: TypeScript error in `MasterGrid.tsx` — `buildColumns` called with wrong number of arguments. This is expected and will be fixed in Task 8.

Actually, to keep each task independently buildable, update the `MasterGrid.tsx` call to `buildColumns` in this same step. In `src/components/table/MasterGrid.tsx`, find line 39:

```tsx
  const columns = useMemo(() => buildColumns(teamsMap), [teamsMap])
```

Replace with a temporary no-op (will be properly wired in Task 8):

```tsx
  const columns = useMemo(() => buildColumns(teamsMap, () => {}), [teamsMap])
```

Now run:

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/table/cells/PlayerNameCell.tsx src/components/table/columns.tsx src/components/table/MasterGrid.tsx
git commit -m "feat: make player name clickable, add onPlayerClick to buildColumns"
```

---

## Task 6: Create PlayerFormPage

**Files:**
- Create: `src/pages/PlayerFormPage.tsx`

- [ ] **Step 1: Create the page**

Create `src/pages/PlayerFormPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useTeams } from '@/hooks/useTeams'
import { addPlayer, updatePlayer } from '@/api/players'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { POSITIONS, PREFERRED_FOOT_OPTIONS, PLAYER_STATUS_OPTIONS } from '@/lib/constants'
import type { PlayerInsert, PlayerUpdate, SocialLinks } from '@/types/player'

type FormErrors = Partial<Record<string, string>>

const SELECT_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

function isValidUrl(val: string): boolean {
  if (!val.trim()) return true
  try {
    new URL(val)
    return true
  } catch {
    return false
  }
}

export function PlayerFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { players, isLoading } = usePlayers()
  const { teams } = useTeams()

  const existing = id ? players.find(p => p.id === id) : undefined

  // ── Form state (all hooks before any early return) ──────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [nationality, setNationality] = useState('')
  const [secondNationality, setSecondNationality] = useState('')
  const [preferredFoot, setPreferredFoot] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [currentClub, setCurrentClub] = useState('')
  const [league, setLeague] = useState('')
  const [position, setPosition] = useState('')
  const [contractExpiry, setContractExpiry] = useState('')
  const [marketValue, setMarketValue] = useState('')
  const [agentName, setAgentName] = useState('')
  const [agentContact, setAgentContact] = useState('')
  const [fbrefUrl, setFbrefUrl] = useState('')
  const [transfermarktUrl, setTransfermarktUrl] = useState('')
  const [instagram, setInstagram] = useState('')
  const [youtube, setYoutube] = useState('')
  const [bestFitTeamId, setBestFitTeamId] = useState('')
  const [status, setStatus] = useState<'active' | 'watchlist' | 'archived'>('active')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Populate form when editing an existing player (runs when data loads)
  useEffect(() => {
    if (!existing) return
    const social = (existing.social_links ?? {}) as SocialLinks
    setFirstName(existing.first_name)
    setLastName(existing.last_name)
    setDateOfBirth(existing.date_of_birth ?? '')
    setNationality(existing.nationality ?? '')
    setSecondNationality(existing.second_nationality ?? '')
    setPreferredFoot(existing.preferred_foot ?? '')
    setHeightCm(existing.height_cm?.toString() ?? '')
    setWeightKg(existing.weight_kg?.toString() ?? '')
    setCurrentClub(existing.current_club ?? '')
    setLeague(existing.league ?? '')
    setPosition(existing.position ?? '')
    setContractExpiry(existing.contract_expiry ?? '')
    setMarketValue(existing.market_value ?? '')
    setAgentName(existing.agent_name ?? '')
    setAgentContact(existing.agent_contact ?? '')
    setFbrefUrl(existing.fbref_url ?? '')
    setTransfermarktUrl(existing.transfermarkt_url ?? '')
    setInstagram(social.instagram ?? '')
    setYoutube(social.youtube ?? '')
    setBestFitTeamId(existing.best_fit_team_id ?? '')
    setStatus(existing.status)
  }, [existing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early returns (after all hooks) ────────────────────────────────────
  if (isEdit && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    )
  }
  if (isEdit && !existing) {
    return <Navigate to="/players" replace />
  }

  // ── Validation + submission ─────────────────────────────────────────────
  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!firstName.trim()) e.firstName = t('playerForm.errors.required')
    if (!lastName.trim()) e.lastName = t('playerForm.errors.required')
    if (!isValidUrl(fbrefUrl)) e.fbrefUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(transfermarktUrl)) e.transfermarktUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(instagram)) e.instagram = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(youtube)) e.youtube = t('playerForm.errors.invalidUrl')
    return e
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)

    const social_links: SocialLinks = Object.fromEntries(
      Object.entries({ instagram, youtube }).filter(([, v]) => v.trim()),
    ) as SocialLinks

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth || null,
      nationality: nationality.trim() || null,
      second_nationality: secondNationality.trim() || null,
      preferred_foot: (preferredFoot as 'Left' | 'Right' | 'Both') || null,
      height_cm: heightCm ? Number(heightCm) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      current_club: currentClub.trim() || null,
      league: league.trim() || null,
      position: position.trim() || null,
      contract_expiry: contractExpiry || null,
      market_value: marketValue.trim() || null,
      agent_name: agentName.trim() || null,
      agent_contact: agentContact.trim() || null,
      fbref_url: fbrefUrl.trim() || null,
      transfermarkt_url: transfermarktUrl.trim() || null,
      social_links,
      best_fit_team_id: bestFitTeamId || null,
      status,
    }

    try {
      if (isEdit && id) {
        await updatePlayer(id, payload as PlayerUpdate)
        toast.success(t('toast.playerUpdated'))
      } else {
        await addPlayer(payload as PlayerInsert)
        toast.success(t('toast.playerAdded'))
      }
      navigate('/players')
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    void handleSave()
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Page header */}
      <div className="mb-6 grid grid-cols-3 items-center">
        <button
          type="button"
          onClick={() => navigate('/players')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          {t('playerForm.back')}
        </button>
        <h1 className="text-center text-xl font-semibold text-gray-900">
          {isEdit ? t('playerForm.editTitle') : t('playerForm.addTitle')}
        </h1>
        <div className="flex justify-end">
          <Button loading={submitting} onClick={() => void handleSave()}>
            {t('playerForm.savePlayer')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
        {/* ── BASIC INFO ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.basicInfo')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('playerForm.fields.firstName')}
              required
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              error={errors.firstName}
            />
            <Input
              label={t('playerForm.fields.lastName')}
              required
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              error={errors.lastName}
            />
            <Input
              label={t('playerForm.fields.dateOfBirth')}
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.nationality')}
              value={nationality}
              onChange={e => setNationality(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.secondNationality')}
              value={secondNationality}
              onChange={e => setSecondNationality(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('playerForm.fields.preferredFoot')}
              </label>
              <select
                value={preferredFoot}
                onChange={e => setPreferredFoot(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">—</option>
                {PREFERRED_FOOT_OPTIONS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <Input
              label={t('playerForm.fields.heightCm')}
              type="number"
              min="100"
              max="230"
              value={heightCm}
              onChange={e => setHeightCm(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.weightKg')}
              type="number"
              min="40"
              max="150"
              value={weightKg}
              onChange={e => setWeightKg(e.target.value)}
            />
          </div>
        </section>

        {/* ── CLUB & POSITION ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.clubPosition')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('playerForm.fields.currentClub')}
              value={currentClub}
              onChange={e => setCurrentClub(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.league')}
              value={league}
              onChange={e => setLeague(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('playerForm.fields.position')}
              </label>
              <select
                value={position}
                onChange={e => setPosition(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">—</option>
                {POSITIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <Input
              label={t('playerForm.fields.contractExpiry')}
              type="date"
              value={contractExpiry}
              onChange={e => setContractExpiry(e.target.value)}
            />
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.marketValue')}
                placeholder="e.g. €5M"
                value={marketValue}
                onChange={e => setMarketValue(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ── AGENT ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.agent')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('playerForm.fields.agentName')}
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.agentContact')}
              value={agentContact}
              onChange={e => setAgentContact(e.target.value)}
            />
          </div>
        </section>

        {/* ── LINKS & SOCIAL ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.linksSocial')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.fbrefUrl')}
                type="url"
                placeholder="https://fbref.com/en/players/..."
                value={fbrefUrl}
                onChange={e => setFbrefUrl(e.target.value)}
                error={errors.fbrefUrl}
              />
            </div>
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.transfermarktUrl')}
                type="url"
                placeholder="https://www.transfermarkt.com/..."
                value={transfermarktUrl}
                onChange={e => setTransfermarktUrl(e.target.value)}
                error={errors.transfermarktUrl}
              />
            </div>
            <Input
              label={t('playerForm.fields.instagram')}
              type="url"
              placeholder="https://instagram.com/..."
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              error={errors.instagram}
            />
            <Input
              label={t('playerForm.fields.youtube')}
              type="url"
              placeholder="https://youtube.com/..."
              value={youtube}
              onChange={e => setYoutube(e.target.value)}
              error={errors.youtube}
            />
          </div>
        </section>

        {/* ── INTERNAL SCOUTING ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.internal')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('playerForm.fields.bestFitTeam')}
              </label>
              <select
                value={bestFitTeamId}
                onChange={e => setBestFitTeamId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">{t('playerForm.fields.noTeam')}</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.team_name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('playerForm.fields.status')}
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'active' | 'watchlist' | 'archived')}
                className={SELECT_CLASS}
              >
                {PLAYER_STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0 (PlayerFormPage compiles; it's not yet imported by App.tsx so no route exists yet).

- [ ] **Step 3: Commit**

```bash
git add src/pages/PlayerFormPage.tsx
git commit -m "feat: add PlayerFormPage with 5-section scrolling form"
```

---

## Task 7: Create PlayerDetailPanel

**Files:**
- Create: `src/components/players/PlayerDetailPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/players/PlayerDetailPanel.tsx`:

```tsx
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ExternalLink, X } from 'lucide-react'
import { PlayerStatsCard } from './PlayerStatsCard'
import { SocialLinksDisplay } from './SocialLinksDisplay'
import { useAuth } from '@/hooks/useAuth'
import { useTeams } from '@/hooks/useTeams'
import { updatePlayer, deletePlayer } from '@/api/players'
import { Button } from '@/components/ui/Button'
import type { Player, SocialLinks } from '@/types/player'

interface Props {
  player: Player
  onClose: () => void
}

function computeAge(dob: string | null): string {
  if (!dob) return '—'
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--
  }
  return `${age} yrs`
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value || '—'}</dd>
    </div>
  )
}

export function PlayerDetailPanel({ player, onClose }: Props) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { teamsMap } = useTeams()
  const queryClient = useQueryClient()

  async function handleArchive() {
    try {
      await updatePlayer(player.id, { status: 'archived' })
      void queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success(t('toast.playerArchived'))
      onClose()
    } catch {
      toast.error(t('toast.error'))
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('detail.confirmDelete'))) return
    try {
      await deletePlayer(player.id)
      void queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success(t('toast.playerDeleted'))
      onClose()
    } catch {
      toast.error(t('toast.error'))
    }
  }

  const socialLinks = (player.social_links ?? {}) as SocialLinks
  const teamName = player.best_fit_team_id ? teamsMap.get(player.best_fit_team_id) : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col overflow-hidden bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {player.first_name} {player.last_name}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => navigate(`/players/${player.id}/edit`)}>
              {t('detail.edit')}
            </Button>
            {player.status !== 'archived' && (
              <Button size="sm" variant="secondary" onClick={() => void handleArchive()}>
                {t('detail.archive')}
              </Button>
            )}
            {profile?.role === 'admin' && (
              <Button size="sm" variant="danger" onClick={() => void handleDelete()}>
                {t('detail.delete')}
              </Button>
            )}
          </div>

          {/* Stats */}
          <PlayerStatsCard player={player} />

          {/* Basic Info */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t('playerForm.sections.basicInfo')}
            </h3>
            <dl className="grid grid-cols-2 gap-3">
              <Field label="Age" value={computeAge(player.date_of_birth)} />
              <Field label={t('playerForm.fields.nationality')} value={player.nationality} />
              <Field label={t('playerForm.fields.secondNationality')} value={player.second_nationality} />
              <Field label={t('playerForm.fields.preferredFoot')} value={player.preferred_foot} />
              <Field label={t('playerForm.fields.heightCm')} value={player.height_cm ? `${player.height_cm} cm` : null} />
              <Field label={t('playerForm.fields.weightKg')} value={player.weight_kg ? `${player.weight_kg} kg` : null} />
            </dl>
          </section>

          {/* Club & Position */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t('playerForm.sections.clubPosition')}
            </h3>
            <dl className="grid grid-cols-2 gap-3">
              <Field label={t('playerForm.fields.currentClub')} value={player.current_club} />
              <Field label={t('playerForm.fields.league')} value={player.league} />
              <Field label={t('playerForm.fields.position')} value={player.position} />
              <Field label={t('playerForm.fields.contractExpiry')} value={player.contract_expiry} />
              <div className="col-span-2">
                <Field label={t('playerForm.fields.marketValue')} value={player.market_value} />
              </div>
            </dl>
          </section>

          {/* Agent */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t('playerForm.sections.agent')}
            </h3>
            <dl className="grid grid-cols-2 gap-3">
              <Field label={t('playerForm.fields.agentName')} value={player.agent_name} />
              <Field label={t('playerForm.fields.agentContact')} value={player.agent_contact} />
            </dl>
          </section>

          {/* Links & Social */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t('playerForm.sections.linksSocial')}
            </h3>
            <div className="flex flex-col gap-3">
              {player.fbref_url && (
                <a
                  href={player.fbref_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink size={14} />
                  FBref Profile
                </a>
              )}
              {player.transfermarkt_url && (
                <a
                  href={player.transfermarkt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink size={14} />
                  Transfermarkt Profile
                </a>
              )}
              <SocialLinksDisplay links={socialLinks} />
            </div>
          </section>

          {/* Internal Scouting */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
              {t('playerForm.sections.internal')}
            </h3>
            <dl className="grid grid-cols-2 gap-3">
              <Field label={t('playerForm.fields.bestFitTeam')} value={teamName} />
              <Field label={t('playerForm.fields.status')} value={player.status} />
            </dl>
          </section>

          {/* Notes placeholder */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-400">
            {t('detail.notesPlaceholder')}
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/players/PlayerDetailPanel.tsx
git commit -m "feat: add PlayerDetailPanel slide-out with profile sections and actions"
```

---

## Task 8: Wire MasterGrid

**Files:**
- Modify: `src/components/table/MasterGrid.tsx`

- [ ] **Step 1: Replace MasterGrid.tsx**

Replace `src/components/table/MasterGrid.tsx` entirely:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import { PlayerDetailPanel } from '@/components/players/PlayerDetailPanel'
import { buildColumns, HIDDEN_BY_DEFAULT, playerSearchFilter } from './columns'
import type { Player } from '@/types/player'

export function MasterGrid() {
  const { players, isLoading, error } = usePlayers()
  const { teamsMap } = useTeams()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(HIDDEN_BY_DEFAULT)
  const [globalFilter, setGlobalFilter] = useState('')
  const [showColPicker, setShowColPicker] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  const colPickerRef = useRef<HTMLDivElement>(null)

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

  const columns = useMemo(
    () => buildColumns(teamsMap, setSelectedPlayer),
    [teamsMap],
  )

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
    <>
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
            {/* Add Player button */}
            <Link
              to="/players/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Add Player
            </Link>
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

      {/* Detail panel (rendered outside the grid div to avoid z-index issues) */}
      {selectedPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/table/MasterGrid.tsx
git commit -m "feat: wire MasterGrid — Add Player link, detail panel, onPlayerClick"
```

---

## Task 9: Update App.tsx (Routes + Toaster)

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace App.tsx**

Replace `src/App.tsx` entirely:

```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/hooks/useAuth'
import { AuthGuard } from '@/components/layout/AuthGuard'
import { AppLayout } from '@/components/layout/AppLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { SignUpPage } from '@/pages/auth/SignUpPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { MasterGridPage } from '@/pages/MasterGridPage'
import { PlayerFormPage } from '@/pages/PlayerFormPage'
import { AdvancedFilterPage } from '@/pages/AdvancedFilterPage'
import { SettingsPage } from '@/pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" richColors />
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />

            {/* Protected app routes */}
            <Route element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/players" element={<MasterGridPage />} />
                <Route path="/players/new" element={<PlayerFormPage />} />
                <Route path="/players/:id/edit" element={<PlayerFormPage />} />
                <Route path="/filter" element={<AdvancedFilterPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0 with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add player form routes and sonner Toaster to App"
```

---

## Task 10: Wire Realtime in MasterGridPage

**Files:**
- Modify: `src/pages/MasterGridPage.tsx`

- [ ] **Step 1: Update MasterGridPage**

Replace `src/pages/MasterGridPage.tsx`:

```tsx
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

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0. This is the final build verification — all tasks complete.

- [ ] **Step 3: Commit**

```bash
git add src/pages/MasterGridPage.tsx
git commit -m "feat: enable Supabase Realtime sync in MasterGridPage"
```

---

## Final Smoke Test (Manual Browser)

Start dev server: `npm run dev`

- [ ] Navigate to `/players` — "Add Player" button is clickable (not disabled)
- [ ] Click "Add Player" → `/players/new` loads with 5 card sections visible, no stats fields anywhere
- [ ] Fill First Name + Last Name, click "Save Player" → success toast, redirects to `/players`
- [ ] New player appears in grid
- [ ] Click the player's name in the grid → slide-out panel opens from the right
- [ ] Panel shows PlayerStatsCard (with "No stats yet" message), all profile sections, notes placeholder
- [ ] Click "Edit" in panel → `/players/:id/edit` loads pre-filled with player data
- [ ] Change a field, save → "Player updated" toast, back on `/players`, change visible in grid
- [ ] Open two browser tabs on `/players`. Edit a player in one tab → the other tab's grid refreshes within a few seconds (Realtime)
- [ ] Sidebar "Players" item has blue highlight when on the `/players` route

---

## Self-Review

**Spec coverage check:**
- ✅ PlayerFormPage with 5 sections (Basic Info, Club & Position, Agent, Links & Social, Internal Scouting)
- ✅ No stats fields in form
- ✅ Create mode (blank) and edit mode (pre-filled via useEffect sync)
- ✅ PlayerDetailPanel slide-out with PlayerStatsCard, SocialLinksDisplay, external links, notes placeholder, Edit/Archive/Delete actions
- ✅ SocialLinksDisplay — instagram + youtube only, returns null when empty
- ✅ Add Player button wired to `/players/new`
- ✅ Edit button in panel navigates to `/players/:id/edit`
- ✅ addPlayer() / updatePlayer() called on submit with success/error toasts
- ✅ useRealtimeSync — postgres_changes subscription, cache invalidation
- ✅ Sidebar already has NavLink active styles (no task needed)
- ✅ i18n keys in en.json and es.json

**No placeholders found.** All code blocks are complete and compilable.

**Type consistency:** `SocialLinks` with `instagram?` and `youtube?` used consistently in types/player.ts, SocialLinksDisplay props, PlayerFormPage state, and PlayerDetailPanel cast. `Player` type used throughout — no mismatches found.
