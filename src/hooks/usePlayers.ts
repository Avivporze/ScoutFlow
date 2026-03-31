import { useQuery } from '@tanstack/react-query'
import { getPlayers } from '@/api/players'
import type { Player } from '@/types/player'

export function usePlayers() {
  const { data, isPending, error } = useQuery<Player[], Error>({
    queryKey: ['players'],
    queryFn: getPlayers,
    staleTime: 30_000,
  })
  return { players: data ?? [], isLoading: isPending, error }
}
