import {
  createColumnHelper,
  type ColumnDef,
  type FilterFn,
  type VisibilityState,
} from '@tanstack/react-table'
import type { Player } from '@/types/player'
import type { Json } from '@/types/database'
import { ContractCell } from './cells/ContractCell'
import { PlayerNameCell } from './cells/PlayerNameCell'
import { PositionBadge } from './cells/PositionBadge'
import { StatusCell } from './cells/StatusCell'
import { TM_COUNTRY_ISO, LEAGUE_ISO } from '@/lib/countryIso'

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
  second_nationality: false,
  agent_name: false,
  agent_contact: false,
  date_of_birth: false,
  transfermarkt_url: false,
  social_links: false,
  updated_at: false,
  added_by: false,
  created_at: false,
  stats_updated_at: false,
}

// ── Column definitions ─────────────────────────────────────────────────────

const col = createColumnHelper<Player>()

export function buildColumns(
  onPlayerClick: (player: Player) => void,
  t: (key: string) => string,
): ColumnDef<Player, unknown>[] {
  return [
    // ── Default visible ──────────────────────────────────────────────────
    col.accessor(row => `${row.first_name} ${row.last_name}`, {
      id: 'fullName',
      header: t('columnHeaders.name'),
      cell: info => <PlayerNameCell player={info.row.original} onClick={onPlayerClick} />,
    }),
    col.accessor(row => computeAge(row.date_of_birth), {
      id: 'age',
      header: t('columnHeaders.age'),
      cell: info => info.getValue() ?? '—',
    }),
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
    col.accessor('position', {
      header: t('columnHeaders.position'),
      cell: info => <PositionBadge position={info.getValue()} />,
    }),
    col.accessor('current_club', {
      header: t('columnHeaders.club'),
      cell: info => info.getValue() ?? '—',
    }),
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
    col.accessor('contract_expiry', {
      header: t('columnHeaders.contract'),
      cell: info => <ContractCell contractExpiry={info.getValue()} />,
    }),
    col.accessor('best_fit_team_id', {
      header: t('columnHeaders.bestFit'),
      cell: info => {
        const v = info.getValue()
        return v ? <span className="text-gray-700">{v}</span> : <span className="text-gray-400">—</span>
      },
    }),
    col.accessor('market_value', {
      id: 'market_value',
      header: t('columnHeaders.value'),
      cell: info => {
        const v = info.getValue()
        if (!v) return '—'
        return v.startsWith('€') ? v : `€${v}`
      },
    }),
    col.accessor('stats_matches', {
      header: t('columnHeaders.matches'),
      cell: info => statDisplay(info.getValue(), info.row.original.stats_updated_at),
    }),
    col.accessor('stats_goals', {
      header: t('columnHeaders.goals'),
      cell: info => statDisplay(info.getValue(), info.row.original.stats_updated_at),
    }),
    col.accessor('stats_assists', {
      header: t('columnHeaders.assists'),
      cell: info => statDisplay(info.getValue(), info.row.original.stats_updated_at),
    }),
    col.accessor('status', {
      header: t('columnHeaders.status'),
      cell: info => <StatusCell status={info.getValue()} />,
    }),
    // ── Hidden by default ────────────────────────────────────────────────
    col.accessor('stats_minutes', {
      header: t('columnHeaders.minutes'),
      cell: info => statDisplay(info.getValue(), info.row.original.stats_updated_at),
    }),
    col.accessor('preferred_foot', {
      header: t('columnHeaders.foot'),
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('height_cm', {
      header: t('columnHeaders.height'),
      cell: info => {
        const v = info.getValue()
        return v !== null ? `${v} cm` : '—'
      },
    }),
    col.accessor('second_nationality', {
      header: t('columnHeaders.secondNat'),
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('agent_name', {
      header: t('columnHeaders.agent'),
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('agent_contact', {
      header: t('columnHeaders.agentContact'),
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('date_of_birth', {
      header: t('columnHeaders.dob'),
      cell: info => {
        const v = info.getValue()
        return v
          ? new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
          : '—'
      },
    }),
    col.accessor('transfermarkt_url', {
      header: t('columnHeaders.tmUrl'),
      cell: info => {
        const v = info.getValue()
        if (!v) return '—'
        return (
          <a
            href={v}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline truncate block max-w-[150px]"
            title={v}
          >
            TM Profile
          </a>
        )
      },
    }),
    col.accessor('social_links', {
      header: t('columnHeaders.socials'),
      cell: info => {
        const v = info.getValue() as Record<string, string> | Json
        if (!v || typeof v !== 'object' || Array.isArray(v)) return '—'
        const links = Object.entries(v as Record<string, string>).filter(([, url]) => url)
        if (links.length === 0) return '—'
        return (
          <span className="text-xs text-gray-600" title={links.map(([k]) => k).join(', ')}>
            {links.length} link{links.length > 1 ? 's' : ''}
          </span>
        )
      },
    }),
    col.accessor('updated_at', {
      header: t('columnHeaders.updated'),
      cell: info =>
        new Date(info.getValue()).toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'short',
        }),
    }),
    col.accessor('added_by', {
      header: t('columnHeaders.addedBy'),
      cell: info => (
        <span className="font-mono text-xs text-gray-400">{info.getValue().slice(0, 8)}…</span>
      ),
    }),
    col.accessor('created_at', {
      header: t('columnHeaders.added'),
      cell: info =>
        new Date(info.getValue()).toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'short',
        }),
    }),
    col.accessor('stats_updated_at', {
      header: t('columnHeaders.statsUpdated'),
      cell: info => {
        const v = info.getValue()
        return v
          ? new Date(v).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
          : t('grid.statsNever')
      },
    }),
  ] as ColumnDef<Player, unknown>[]
}
