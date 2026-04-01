// src/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query'
import {
  getDashboardStats,
  getRecentActivity,
  getTopPerformers,
  getRecentProspects,
  getPositionalPipeline,
  type DashboardStats,
  type ActivityWithDetails,
} from '@/api/dashboard'
import type { Player } from '@/types/player'

const EMPTY_STATS: DashboardStats = {
  totalPlayers: 0,
  watchlistCount: 0,
  teamsScouted: 0,
  countriesScouted: 0,
}

export function useDashboardStats() {
  const query = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isPending,
    isError: query.isError,
  }
}

export function useRecentActivity(limit = 20) {
  const query = useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: () => getRecentActivity(limit),
    staleTime: 1000 * 60, // 1 minute
  })

  return {
    activity: query.data ?? ([] as ActivityWithDetails[]),
    isLoading: query.isPending,
    isError: query.isError,
  }
}

export function useTopPerformers(limit = 4) {
  const query = useQuery({
    queryKey: ['dashboard', 'topPerformers', limit],
    queryFn: () => getTopPerformers(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    players: query.data ?? ([] as Player[]),
    isLoading: query.isPending,
    isError: query.isError,
  }
}

export function usePositionalPipeline() {
  const query = useQuery({
    queryKey: ['dashboard', 'positionalPipeline'],
    queryFn: getPositionalPipeline,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    pipeline: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
  }
}

export function useRecentProspects(limit = 4) {
  const query = useQuery({
    queryKey: ['dashboard', 'recentProspects', limit],
    queryFn: () => getRecentProspects(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    players: query.data ?? ([] as Player[]),
    isLoading: query.isPending,
    isError: query.isError,
  }
}
