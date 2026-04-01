import { useQuery } from '@tanstack/react-query'
import { filterPlayers } from '@/api/players'
import type { PlayerFilters } from '@/api/players'
import type { Player } from '@/types/player'

export function useFilteredPlayers(filters: PlayerFilters) {
  const { data, isPending, error } = useQuery<Player[], Error>({
    queryKey: ['players', 'filtered', filters],
    queryFn: () => filterPlayers(filters),
    staleTime: 30_000,
  })
  return { players: data ?? [], isLoading: isPending, error }
}
