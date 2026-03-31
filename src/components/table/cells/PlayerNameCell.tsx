import type { Player } from '@/types/player'

interface Props {
  player: Player
}

export function PlayerNameCell({ player }: Props) {
  return (
    <span className="font-medium text-gray-900">
      {player.first_name} {player.last_name}
    </span>
  )
}
