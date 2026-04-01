import { supabase } from './supabase'
import type { ActivityLogEntry } from '@/types/activity'

export interface DashboardStats {
  totalPlayers: number
  recentNotesCount: number
  contractAlertsCount: number
}

export interface ActivityWithDetails extends ActivityLogEntry {
  profiles: { full_name: string } | null
  players: { first_name: string; last_name: string } | null
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  // 12 months from today — use year+1 to avoid month-overflow edge cases
  const twelveMonthsFromNow = new Date(
    now.getFullYear() + 1,
    now.getMonth(),
    now.getDate(),
  ).toISOString()
  const todayISO = now.toISOString()

  const [playersResult, notesResult, contractResult] = await Promise.all([
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived'),
    supabase
      .from('player_notes')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived')
      .not('contract_expiry', 'is', null)
      .gt('contract_expiry', todayISO)
      .lte('contract_expiry', twelveMonthsFromNow),
  ])

  if (playersResult.error) throw playersResult.error
  if (notesResult.error) throw notesResult.error
  if (contractResult.error) throw contractResult.error

  return {
    totalPlayers: playersResult.count ?? 0,
    recentNotesCount: notesResult.count ?? 0,
    contractAlertsCount: contractResult.count ?? 0,
  }
}

export async function getRecentActivity(limit = 20): Promise<ActivityWithDetails[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles(full_name), players(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as unknown as ActivityWithDetails[]
}
