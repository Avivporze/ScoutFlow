// src/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query'
import {
  getDashboardStats,
  getRecentActivity,
  type DashboardStats,
  type ActivityWithDetails,
} from '@/api/dashboard'

const EMPTY_STATS: DashboardStats = {
  totalPlayers: 0,
  recentNotesCount: 0,
  contractAlertsCount: 0,
}

export function useDashboardStats() {
  const query = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

  return {
    stats: query.data ?? EMPTY_STATS,
    isLoading: query.isLoading,
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
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
