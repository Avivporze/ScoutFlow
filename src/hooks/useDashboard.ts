// src/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query'
import {
  getDashboardStats,
  getRecentActivity,
  getTopPerformers,
  getExpiringContracts,
  getHighestMarketValue,
  getScoutingGaps,
  getScoutingGapCount,
  type DashboardStats,
  type ActivityWithDetails,
  type ExpiringContract,
  type MarketValuePlayer,
  type ScoutingGapPlayer,
} from '@/api/dashboard'
import type { Player } from '@/types/player'

const EMPTY_STATS: DashboardStats = {
  totalPlayers: 0,
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


export function useExpiringContracts(limit = 5) {
  const query = useQuery({
    queryKey: ['dashboard', 'expiringContracts', limit],
    queryFn: () => getExpiringContracts(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    contracts: query.data ?? ([] as ExpiringContract[]),
    isLoading: query.isPending,
    isError: query.isError,
  }
}

export function useHighestMarketValue(limit = 5) {
  const query = useQuery({
    queryKey: ['dashboard', 'highestMarketValue', limit],
    queryFn: () => getHighestMarketValue(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    players: query.data ?? ([] as MarketValuePlayer[]),
    isLoading: query.isPending,
    isError: query.isError,
  }
}

export function useScoutingGaps(limit = 5) {
  const query = useQuery({
    queryKey: ['dashboard', 'scoutingGaps', limit],
    queryFn: () => getScoutingGaps(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    players: query.data ?? ([] as ScoutingGapPlayer[]),
    isLoading: query.isPending,
    isError: query.isError,
  }
}

export function useScoutingGapCount() {
  const query = useQuery({
    queryKey: ['dashboard', 'scoutingGapCount'],
    queryFn: getScoutingGapCount,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    count: query.data ?? 0,
    isLoading: query.isPending,
    isError: query.isError,
  }
}
