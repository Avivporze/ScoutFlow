import { Activity, Clock, Target, Zap } from 'lucide-react'
import type { Player } from '@/types/player'

interface Props {
  player: Player
}

const STATS = [
  { key: 'stats_matches' as const, label: 'Matches', Icon: Activity },
  { key: 'stats_goals' as const, label: 'Goals', Icon: Target },
  { key: 'stats_assists' as const, label: 'Assists', Icon: Zap },
  { key: 'stats_minutes' as const, label: 'Minutes', Icon: Clock },
]

export function PlayerStatsCard({ player }: Props) {
  if (!player.stats_updated_at) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        No stats yet — sync from Transfermarkt to populate.
      </div>
    )
  }

  const updatedAt = new Date(player.stats_updated_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-4 gap-4">
        {STATS.map(({ key, label, Icon }) => (
          <div key={key} className="flex flex-col items-center gap-1">
            <Icon size={16} className="text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">{player[key]}</span>
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">Last updated: {updatedAt}</p>
    </div>
  )
}
