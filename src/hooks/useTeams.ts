import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getTeams,
  addTeam,
  updateTeam,
  deleteTeam,
  swapTeamOrder,
} from '@/api/teams'
import type { InternalTeam, InternalTeamInsert, InternalTeamUpdate } from '@/types/team'

export function useTeams() {
  const { data, isPending, error } = useQuery<InternalTeam[], Error>({
    queryKey: ['teams'],
    queryFn: getTeams,
    staleTime: 5 * 60_000,
  })
  const teams = data ?? []
  const teamsMap = new Map(teams.map(t => [t.id, t.team_name]))
  return { teams, teamsMap, isLoading: isPending, error }
}

export function useAddTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (team: InternalTeamInsert) => addTeam(team),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['teams'] }) },
  })
}

export function useUpdateTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: InternalTeamUpdate }) =>
      updateTeam(id, updates),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['teams'] }) },
  })
}

export function useDeleteTeam() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTeam(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['teams'] }) },
  })
}

export function useSwapTeamOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      teamA,
      teamB,
    }: {
      teamA: { id: string; sort_order: number }
      teamB: { id: string; sort_order: number }
    }) => swapTeamOrder(teamA, teamB),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['teams'] }) },
  })
}

