import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Download, X } from 'lucide-react'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { PlayerDetailPanel } from '@/components/players/PlayerDetailPanel'
import { buildColumns, HIDDEN_BY_DEFAULT } from '@/components/table/columns'
import { useFilteredPlayers } from '@/hooks/useFilteredPlayers'
import { useTeams } from '@/hooks/useTeams'
import type { Player } from '@/types/player'
import type { PlayerFilters } from '@/api/players'

// ── Constants ───────────────────────────────────────────────────────────────

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'SS', 'ST', 'CF']
// Removed unused constants

// ── Helpers ─────────────────────────────────────────────────────────────────

function toNum(v: string | null): number | undefined {
  if (!v) return undefined
  const n = Number(v)
  return isNaN(n) ? undefined : n
}

function parseFilters(sp: URLSearchParams): PlayerFilters {
  return {
    search: sp.get('search') ?? undefined,
    position: sp.get('position') ?? undefined,
    status: sp.get('status') ?? undefined,
    foot: sp.get('foot') ?? undefined,
    nationality: sp.get('nationality') ?? undefined,
    league: sp.get('league') ?? undefined,
    minAge: toNum(sp.get('minAge')),
    maxAge: toNum(sp.get('maxAge')),
    minGoals: toNum(sp.get('minGoals')),
    maxGoals: toNum(sp.get('maxGoals')),
    minAssists: toNum(sp.get('minAssists')),
    maxAssists: toNum(sp.get('maxAssists')),
    minMatches: toNum(sp.get('minMatches')),
    maxMatches: toNum(sp.get('maxMatches')),
  }
}

function computeAge(dob: string | null): number | null {
  if (!dob) return null
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age--
  return age
}

function exportToCSV(players: Player[]) {
  const headers = ['Name', 'Age', 'Position', 'Club', 'League', 'Nationality', 'Status', 'Goals', 'Assists', 'Matches', 'Minutes', 'Contract Expiry']
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = players.map(p => [
    `${p.first_name} ${p.last_name}`,
    computeAge(p.date_of_birth) ?? '',
    p.position ?? '',
    p.current_club ?? '',
    p.league ?? '',
    p.nationality ?? '',
    p.status,
    p.stats_goals,
    p.stats_assists,
    p.stats_matches,
    p.stats_minutes,
    p.contract_expiry ?? '',
  ].map(escape).join(','))
  const csv = [headers.map(escape).join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'scout-players.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ────────────────────────────────────────────────────────────────

export function AdvancedFilterPage() {
  const { t, i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { teamsMap } = useTeams()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility] = useState<VisibilityState>(HIDDEN_BY_DEFAULT)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)

  // Local state for debounced text inputs
  const [localSearch, setLocalSearch] = useState(searchParams.get('search') ?? '')
  const [localNationality, setLocalNationality] = useState(searchParams.get('nationality') ?? '')
  const [localLeague, setLocalLeague] = useState(searchParams.get('league') ?? '')

  const filters = useMemo(() => parseFilters(searchParams), [searchParams])
  const { players, isLoading, error } = useFilteredPlayers(filters)

  const columns = useMemo(
    () => buildColumns(teamsMap, setSelectedPlayer, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamsMap, i18n.language],
  )

  const table = useReactTable({
    data: players,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  // Helper: set or delete a single URL param
  const setParam = (key: string, value: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    }, { replace: true })
  }

  // Debounce text inputs → URL (400ms)
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const debounceParam = (key: string, value: string) => {
    clearTimeout(debounceRef.current[key])
    debounceRef.current[key] = setTimeout(() => setParam(key, value), 400)
  }

  const hasFilters = [...searchParams.entries()].length > 0

  const clearAll = () => {
    // Cancel pending debounces before clearing URL
    Object.values(debounceRef.current).forEach(clearTimeout)
    debounceRef.current = {}
    setLocalSearch('')
    setLocalNationality('')
    setLocalLeague('')
    setSearchParams({}, { replace: true })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      <div className="flex flex-col gap-4">

        {/* Page header */}
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">{t('filter.title')}</h1>
          <button
            onClick={() => exportToCSV(players)}
            disabled={players.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={14} />
            {t('filter.exportCsv')}
          </button>
        </div>

        {/* Filter panel */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">

            {/* Name search */}
            <div className="flex flex-col gap-1 xl:col-span-2">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.name')}</label>
              <input
                type="text"
                value={localSearch}
                onChange={e => {
                  setLocalSearch(e.target.value)
                  debounceParam('search', e.target.value)
                }}
                placeholder={t('filter.placeholders.searchPlayers')}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Position — value stays as English abbreviation (GK, CM…); positions are universal in football */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.position')}</label>
              <select
                value={filters.position ?? ''}
                onChange={e => setParam('position', e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{t('filter.options.allPositions')}</option>
                {POSITIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Status — value stays English (active/watchlist/archived); label is translated */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.status')}</label>
              <select
                value={filters.status ?? ''}
                onChange={e => setParam('status', e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{t('filter.options.allStatuses')}</option>
                <option value="active">{t('filter.options.active')}</option>
                <option value="watchlist">{t('filter.options.watchlist')}</option>
                <option value="archived">{t('filter.options.archived')}</option>
              </select>
            </div>

            {/* Foot — value stays English (Left/Right/Both); label is translated */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.foot')}</label>
              <select
                value={filters.foot ?? ''}
                onChange={e => setParam('foot', e.target.value)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">{t('filter.options.anyFoot')}</option>
                <option value="Left">{t('filter.options.left')}</option>
                <option value="Right">{t('filter.options.right')}</option>
                <option value="Both">{t('filter.options.both')}</option>
              </select>
            </div>

            {/* Nationality */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.nationality')}</label>
              <input
                type="text"
                value={localNationality}
                onChange={e => {
                  setLocalNationality(e.target.value)
                  debounceParam('nationality', e.target.value)
                }}
                placeholder={t('filter.placeholders.nationality')}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* League */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.league')}</label>
              <input
                type="text"
                value={localLeague}
                onChange={e => {
                  setLocalLeague(e.target.value)
                  debounceParam('league', e.target.value)
                }}
                placeholder={t('filter.placeholders.league')}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Age range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.age')}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={14}
                  max={45}
                  value={filters.minAge ?? ''}
                  onChange={e => setParam('minAge', e.target.value)}
                  placeholder={t('filter.placeholders.min')}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">–</span>
                <input
                  type="number"
                  min={14}
                  max={45}
                  value={filters.maxAge ?? ''}
                  onChange={e => setParam('maxAge', e.target.value)}
                  placeholder={t('filter.placeholders.max')}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Goals range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.goals')}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={filters.minGoals ?? ''}
                  onChange={e => setParam('minGoals', e.target.value)}
                  placeholder={t('filter.placeholders.min')}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">–</span>
                <input
                  type="number"
                  min={0}
                  value={filters.maxGoals ?? ''}
                  onChange={e => setParam('maxGoals', e.target.value)}
                  placeholder={t('filter.placeholders.max')}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Assists range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.assists')}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={filters.minAssists ?? ''}
                  onChange={e => setParam('minAssists', e.target.value)}
                  placeholder={t('filter.placeholders.min')}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">–</span>
                <input
                  type="number"
                  min={0}
                  value={filters.maxAssists ?? ''}
                  onChange={e => setParam('maxAssists', e.target.value)}
                  placeholder={t('filter.placeholders.max')}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Matches range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">{t('filter.labels.matches')}</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={filters.minMatches ?? ''}
                  onChange={e => setParam('minMatches', e.target.value)}
                  placeholder={t('filter.placeholders.min')}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">–</span>
                <input
                  type="number"
                  min={0}
                  value={filters.maxMatches ?? ''}
                  onChange={e => setParam('maxMatches', e.target.value)}
                  placeholder={t('filter.placeholders.max')}
                  className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

          </div>

          {/* Clear all */}
          {hasFilters && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                <X size={12} />
                {t('filter.clearAll')}
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {t('filter.results.loadError')}
          </div>
        )}

        {/* Results table */}
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
                Array.from({ length: 6 }).map((_, i) => (
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
                    {hasFilters ? t('filter.results.noMatch') : t('filter.results.empty')}
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
            {t(
              players.length === 1 ? 'filter.results.playerFound' : 'filter.results.playersFound',
              { count: players.length },
            )}
          </p>
        )}
      </div>

      {/* Detail panel */}
      {selectedPlayer && (
        <PlayerDetailPanel
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </PageWrapper>
  )
}
