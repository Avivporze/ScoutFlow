import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
  type Header,
  type Row,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Search, GripVertical } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useTeams } from '@/hooks/useTeams'
import { PlayerDetailPanel } from '@/components/players/PlayerDetailPanel'
import { buildColumns, HIDDEN_BY_DEFAULT, playerSearchFilter } from './columns'
import type { Player } from '@/types/player'

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
  useSortable,
} from '@dnd-kit/sortable'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'

const DraggableHeader = ({ header }: { header: Header<Player, unknown> }) => {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
    })

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    transition: 'width transform 0.2s ease-in-out',
    whiteSpace: 'nowrap',
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className="border-b border-gray-200 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-50"
    >
      <div className="flex items-center gap-1.5">
        {!header.isPlaceholder && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab text-gray-400 hover:text-gray-900 focus:outline-none touch-none px-1"
            aria-label="Drag to reorder"
          >
            <GripVertical size={14} />
          </button>
        )}
        <div
          onClick={header.column.getToggleSortingHandler()}
          className={
            header.column.getCanSort()
              ? 'cursor-pointer select-none hover:text-gray-700 flex items-center gap-1 flex-1'
              : 'flex items-center gap-1 flex-1'
          }
        >
          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
          {header.column.getCanSort() &&
            ({
              asc: <ArrowUp size={11} className="text-blue-600 shrink-0" />,
              desc: <ArrowDown size={11} className="text-blue-600 shrink-0" />,
            }[header.column.getIsSorted() as string] ?? (
              <ArrowUpDown size={11} className="text-gray-300 shrink-0" />
            ))}
        </div>
      </div>
    </th>
  )
}

interface MasterGridProps {
  contractAlertMode?: boolean
}

export function MasterGrid({ contractAlertMode = false }: MasterGridProps) {
  const { t, i18n } = useTranslation()
  const { players, isLoading, error } = usePlayers()
  const { teamsMap } = useTeams()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(HIDDEN_BY_DEFAULT)
  const [globalFilter, setGlobalFilter] = useState('')
  const [showColPicker, setShowColPicker] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [columnOrder, setColumnOrder] = useState<string[]>([])

  const navigate = useNavigate()

  // When contractAlertMode is active, pre-filter to players whose contracts
  // expire within the next 12 months (future-only, non-archived).
  const displayPlayers = useMemo(() => {
    if (!contractAlertMode) return players
    const now = new Date()
    const cutoff = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    return players.filter(
      (p) =>
        p.contract_expiry &&
        new Date(p.contract_expiry) > now &&
        new Date(p.contract_expiry) <= cutoff &&
        p.status !== 'archived',
    )
  }, [players, contractAlertMode])

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
    () => buildColumns(teamsMap, setSelectedPlayer, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teamsMap, i18n.language],
  )

  const table = useReactTable({
    data: displayPlayers,
    columns,
    state: { sorting, columnVisibility, globalFilter, ...(columnOrder.length > 0 ? { columnOrder } : {}) },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onColumnOrderChange: setColumnOrder,
    globalFilterFn: playerSearchFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // Virtualization
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const { rows } = table.getRowModel()
  
  const rowVirtualizer = useVirtualizer({
    count: isLoading ? 8 : rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 45, // roughly the height of a table row
    overscan: 10,
  })

  // DnD Sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

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

  const virtualItems = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0
  const paddingBottom = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end || 0)
    : 0

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {t('grid.loadError')}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Top bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold text-gray-900">{t('grid.title')}</h1>
          <div className="flex items-center gap-2">
            {/* Column visibility toggle */}
            <div ref={colPickerRef} className="relative">
              <button
                onClick={() => setShowColPicker(v => !v)}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 max-w-full"
              >
                <Columns3 size={14} className="shrink-0" />
                <span className="truncate">{t('grid.columns')}</span>
              </button>
              {showColPicker && (
                <div className="absolute right-0 sm:left-auto top-full z-10 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto">
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
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 whitespace-nowrap"
            >
              + {t('grid.addPlayer')}
            </Link>
          </div>
        </div>

        {/* Contract alert filter banner */}
        {contractAlertMode && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 flex-wrap gap-2">
            <span>
              Contract alert filter active — showing players with contracts expiring within 12 months.
            </span>
            <button
              onClick={() => navigate('/players')}
              className="flex-shrink-0 font-medium text-amber-600 hover:text-amber-800"
              aria-label="Clear contract alert filter"
            >
              ✕ Clear
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-full sm:max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder={t('grid.searchPlaceholder')}
            className="w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Table Container (Virtual boundaries + overflow handle) */}
        <div 
          ref={tableContainerRef}
          className="relative overflow-x-auto overflow-y-auto rounded-lg border border-gray-200"
          style={{ maxHeight: 'min(70vh, 800px)' }}
        >
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
          >
            <table className="w-full border-collapse text-sm min-w-max">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
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
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} colSpan={table.getVisibleLeafColumns().length} />
                  </tr>
                )}
                
                {isLoading ? (
                  virtualItems.map((virtualRow) => (
                    <tr key={virtualRow.key} className="h-[45px]">
                      {table.getVisibleLeafColumns().map(col => (
                        <td key={col.id} className="px-3 py-2.5">
                          <div className="h-4 animate-pulse rounded bg-gray-100" />
                        </td>
                      ))}
                    </tr>
                  ))
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
                  virtualItems.map(virtualRow => {
                    const row = rows[virtualRow.index] as Row<Player>
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 h-[45px]">
                        {row.getVisibleCells().map(cell => (
                          <td key={cell.id} className="px-3 py-2.5">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}

                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} colSpan={table.getVisibleLeafColumns().length} />
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        </div>

        {/* Row count */}
        {!isLoading && (
          <p className="text-xs text-gray-400">
            {t('grid.rowCount', {
              filtered: table.getFilteredRowModel().rows.length,
              total: displayPlayers.length,
            })}
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
