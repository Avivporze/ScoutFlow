import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  type Header,
  type Row,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Search, GripVertical } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { bulkUpdateSortOrder } from '@/api/players'
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
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import {
  restrictToHorizontalAxis,
  restrictToVerticalAxis,
} from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { useVirtualizer } from '@tanstack/react-virtual'

const LS_COL_VISIBILITY = 'scoutflow:column-visibility'
const LS_COL_ORDER = 'scoutflow:column-order'

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const DraggableHeader = ({ header }: { header: Header<Player, unknown> }) => {
  const isDragColumn = header.column.id === 'drag'
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useSortable({
      id: header.column.id,
      disabled: isDragColumn,
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
        {!header.isPlaceholder && !isDragColumn && (
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

interface SortableRowProps {
  row: Row<Player>
  isDndDisabled: boolean
}

const SortableRow = ({ row, isDndDisabled }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.original.id,
    disabled: isDndDisabled,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <tr ref={setNodeRef} style={style} className="hover:bg-gray-50 h-[45px]">
      {row.getVisibleCells().map(cell => {
        if (cell.column.id === 'drag') {
          return (
            <td key={cell.id} className="py-2.5 px-2 w-8">
              {!isDndDisabled && (
                <button
                  {...attributes}
                  {...listeners}
                  className="cursor-grab text-gray-300 hover:text-gray-500 focus:outline-none touch-none"
                  aria-label="Drag to reorder player"
                >
                  <GripVertical size={14} />
                </button>
              )}
            </td>
          )
        }
        return (
          <td key={cell.id} className="py-2.5 px-3">
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        )
      })}
    </tr>
  )
}

interface MasterGridProps {
  contractAlertMode?: boolean
}

export function MasterGrid({ contractAlertMode = false }: MasterGridProps) {
  const { t, i18n } = useTranslation()
  const { players, isLoading, error } = usePlayers()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    () => loadJson(LS_COL_VISIBILITY, HIDDEN_BY_DEFAULT),
  )
  const [globalFilter, setGlobalFilter] = useState('')
  const [showColPicker, setShowColPicker] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = loadJson<string[]>(LS_COL_ORDER, [])
    // Migration: ensure `drag` column is always first (handles existing saved orders)
    if (saved.length > 0 && !saved.includes('drag')) {
      return ['drag', ...saved]
    }
    return saved
  })

  // Manual row order — initialised from DB-sorted players, updated on drag
  const [localPlayerOrder, setLocalPlayerOrder] = useState<string[]>([])
  const pendingOrderRef = useRef<string[]>([])
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync order from DB on initial load and after query re-fetch
  useEffect(() => {
    setLocalPlayerOrder(players.map(p => p.id))
  }, [players])

  // Cleanup: cancel any pending debounced DB write when the component unmounts
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
    }
  }, [])

  const navigate = useNavigate()

  useEffect(() => {
    localStorage.setItem(LS_COL_VISIBILITY, JSON.stringify(columnVisibility))
  }, [columnVisibility])

  useEffect(() => {
    if (columnOrder.length > 0) {
      localStorage.setItem(LS_COL_ORDER, JSON.stringify(columnOrder))
    }
  }, [columnOrder])

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

  // When a header sort is active, TanStack Table handles ordering.
  // Otherwise, respect the manual localPlayerOrder (source of truth).
  const orderedPlayers = useMemo(() => {
    if (sorting.length > 0 || localPlayerOrder.length === 0) return displayPlayers
    const idToPlayer = new Map(displayPlayers.map(p => [p.id, p]))
    return localPlayerOrder
      .filter(id => idToPlayer.has(id))
      .map(id => idToPlayer.get(id)!)
  }, [displayPlayers, localPlayerOrder, sorting])

  const colButtonRef = useRef<HTMLButtonElement>(null)
  const colDropdownRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

  useEffect(() => {
    if (!showColPicker) return
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node
      if (
        (!colButtonRef.current || !colButtonRef.current.contains(target)) &&
        (!colDropdownRef.current || !colDropdownRef.current.contains(target))
      ) {
        setShowColPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColPicker])

  const toggleColPicker = () => {
    if (!showColPicker && colButtonRef.current) {
      const rect = colButtonRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setShowColPicker(v => !v)
  }

  const columns = useMemo(
    (): ColumnDef<Player, unknown>[] => [
      // Non-data drag-handle column — not toggleable, not sortable
      {
        id: 'drag',
        header: '',
        size: 32,
        enableSorting: false,
        enableHiding: false,
        cell: () => null, // handle rendered by SortableRow
      },
      ...buildColumns(setSelectedPlayer, t),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [i18n.language],
  )

  const table = useReactTable({
    data: orderedPlayers,
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
    estimateSize: () => 45,
    overscan: 10,
  })

  // DnD Sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {})
  )

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      // Prevent moving the drag-handle column itself
      if (active.id === 'drag' || over.id === 'drag') return
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

  function handleRowDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Resolve against the full order (not the filtered row set) so persistence
    // covers all players, not just those visible in the current search/filter.
    const oldIndex = localPlayerOrder.indexOf(active.id as string)
    const newIndex = localPlayerOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return

    const newOrder = arrayMove(localPlayerOrder, oldIndex, newIndex)
    setLocalPlayerOrder(newOrder)
    pendingOrderRef.current = newOrder

    // Debounce DB write — batches rapid consecutive drags
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current)
    debouncedSaveRef.current = setTimeout(async () => {
      const updates = pendingOrderRef.current.map((id, i) => ({ id, sort_order: i }))
      await bulkUpdateSortOrder(updates).catch(console.error)
    }, 400)
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
            <button
              ref={colButtonRef}
              onClick={toggleColPicker}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 max-w-full"
            >
              <Columns3 size={14} className="shrink-0" />
              <span className="truncate">{t('grid.columns')}</span>
            </button>
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

        {/* Table Container */}
        <div
          ref={tableContainerRef}
          className="relative overflow-x-auto overflow-y-auto rounded-lg border border-gray-200"
          style={{ maxHeight: 'min(70vh, 800px)' }}
        >
          <table className="w-full border-collapse text-sm min-w-max">
            {/* Column DnD: horizontal, restricted to header */}
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <DndContext
                collisionDetection={closestCenter}
                modifiers={[restrictToHorizontalAxis]}
                onDragEnd={handleColumnDragEnd}
                sensors={sensors}
                accessibility={{ container: document.body }}
              >
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
              </DndContext>
            </thead>

            {/* Row DnD: vertical */}
            <DndContext
              collisionDetection={closestCenter}
              modifiers={[restrictToVerticalAxis]}
              onDragEnd={handleRowDragEnd}
              sensors={sensors}
              accessibility={{ container: document.body }}
            >
              <tbody className="divide-y divide-gray-100 bg-white">
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: `${paddingTop}px` }} colSpan={table.getVisibleLeafColumns().length} />
                  </tr>
                )}

                {isLoading ? (
                  <SortableContext items={[]} strategy={verticalListSortingStrategy}>
                    {virtualItems.map((virtualRow) => (
                      <tr key={virtualRow.key} className="h-[45px]">
                        {table.getVisibleLeafColumns().map(col => (
                          <td key={col.id} className="py-2.5 px-3">
                            <div className="h-4 animate-pulse rounded bg-gray-100" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </SortableContext>
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
                  <SortableContext
                    items={rows.map(r => r.original.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {virtualItems.map(virtualRow => {
                      const row = rows[virtualRow.index] as Row<Player>
                      return (
                        <SortableRow
                          key={row.id}
                          row={row}
                          isDndDisabled={sorting.length > 0}
                        />
                      )
                    })}
                  </SortableContext>
                )}

                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: `${paddingBottom}px` }} colSpan={table.getVisibleLeafColumns().length} />
                  </tr>
                )}
              </tbody>
            </DndContext>
          </table>
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

      {/* Column picker — portalled to body so parent overflow can't clip it */}
      {showColPicker && createPortal(
        <div
          ref={colDropdownRef}
          className="fixed z-50 w-52 rounded-md border border-gray-200 bg-white py-1 shadow-lg overflow-y-auto"
          style={{ top: dropdownPos.top, right: dropdownPos.right, maxHeight: `min(24rem, calc(100vh - ${dropdownPos.top + 8}px))` }}
        >
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
              {(typeof column.columnDef.header === 'string' && column.columnDef.header)
                ? column.columnDef.header
                : column.id}
            </label>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}
