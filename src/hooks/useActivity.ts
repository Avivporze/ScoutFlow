import { useQuery } from '@tanstack/react-query'
import { getPlayerActivity } from '@/api/activity'

export function useActivity(playerId: string) {
  const query = useQuery({
    queryKey: ['activity', playerId],
    queryFn: () => getPlayerActivity(playerId),
  })

  return {
    activityLog: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError
  }
}
