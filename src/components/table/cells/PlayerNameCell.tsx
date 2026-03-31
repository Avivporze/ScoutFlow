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
