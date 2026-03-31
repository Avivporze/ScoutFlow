const STATUS_STYLES: Record<'active' | 'archived' | 'watchlist', string> = {
  active: 'bg-green-100 text-green-800',
  watchlist: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-gray-100 text-gray-600',
}

interface Props {
  status: 'active' | 'archived' | 'watchlist'
}

export function StatusCell({ status }: Props) {
  const colorClass = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium capitalize ${colorClass}`}
    >
      {status}
    </span>
  )
}
