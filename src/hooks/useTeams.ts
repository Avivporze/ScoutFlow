import { useQuery } from '@tanstack/react-query'
import { getTeams } from '@/api/teams'
import type { InternalTeam } from '@/types/team'

export function useTeams() {
  const { data } = useQuery<InternalTeam[], Error>({
    queryKey: ['teams'],
    queryFn: getTeams,
    staleTime: 5 * 60_000,
  })
  const teams = data ?? []
  const teamsMap = new Map(teams.map(t => [t.id, t.team_name]))
  return { teams, teamsMap }
}
