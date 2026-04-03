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

export function buildColumns(
  teamsMap: Map<string, string>,
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
      cell: info => info.getValue() ?? '—',
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
      cell: info => info.getValue() ?? '—',
    }),
    col.accessor('contract_expiry', {
      header: t('columnHeaders.contract'),
      cell: info => <ContractCell contractExpiry={info.getValue()} />,
    }),
    col.accessor('best_fit_team_id', {
      header: t('columnHeaders.bestFit'),
      cell: info => <BestFitTeamCell teamId={info.getValue()} teamsMap={teamsMap} />,
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
    col.accessor('weight_kg', {
      header: t('columnHeaders.weight'),
      cell: info => {
        const v = info.getValue()
        return v !== null ? `${v} kg` : '—'
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
