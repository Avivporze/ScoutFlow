const POSITION_COLORS: Record<string, string> = {
  GK: 'bg-purple-100 text-purple-800',
  CB: 'bg-blue-100 text-blue-800',
  LB: 'bg-blue-100 text-blue-800',
  RB: 'bg-blue-100 text-blue-800',
  LWB: 'bg-blue-100 text-blue-800',
  RWB: 'bg-blue-100 text-blue-800',
  CDM: 'bg-green-100 text-green-800',
  CM: 'bg-green-100 text-green-800',
  CAM: 'bg-green-100 text-green-800',
  LM: 'bg-green-100 text-green-800',
  RM: 'bg-green-100 text-green-800',
  LW: 'bg-red-100 text-red-800',
  RW: 'bg-red-100 text-red-800',
  CF: 'bg-red-100 text-red-800',
  ST: 'bg-red-100 text-red-800',
}

interface Props {
  position: string | null
}

export function PositionBadge({ position }: Props) {
  if (!position) return <span className="text-gray-400">—</span>
  const colorClass = POSITION_COLORS[position] ?? 'bg-gray-100 text-gray-800'
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {position}
    </span>
  )
}
