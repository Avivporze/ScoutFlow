import { supabase } from './supabase'
import type { Player } from '@/types/player'

export interface DashboardStats {
  totalPlayers: number
  watchlistCount: number
  teamsScouted: number
  countriesScouted: number
}

export interface ActivityWithDetails {
  id: string
  action_type: string
  created_at: string
  profiles: { full_name: string } | null
  players: { first_name: string; last_name: string } | null
}

export type TopPerformer = Pick<Player, 'id' | 'first_name' | 'last_name' | 'position' | 'current_club' | 'stats_goals' | 'stats_assists'>
export type RecentProspect = Pick<Player, 'id' | 'first_name' | 'last_name' | 'nationality' | 'date_of_birth' | 'created_at'>

export async function getDashboardStats(): Promise<DashboardStats> {
  const [playersResult, watchlistResult, clubResult, nationalityResult] = await Promise.all([
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived'),
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'watchlist'),
    supabase
      .from('players')
      .select('current_club')
      .neq('status', 'archived')
      .not('current_club', 'is', null),
    supabase
      .from('players')
      .select('nationality')
      .neq('status', 'archived')
      .not('nationality', 'is', null)
  ])

  if (playersResult.error || watchlistResult.error || clubResult.error || nationalityResult.error) {
    throw new Error('Failed to fetch dashboard stats.')
  }

  const uniqueCountries = new Set(
    (nationalityResult.data || [])
      .map((d) => d.nationality?.trim())
      .filter(Boolean)
  )

  const uniqueClubs = new Set(
    (clubResult.data || [])
      .map((d) => d.current_club?.trim())
      .filter(Boolean)
  )

  return {
    totalPlayers: playersResult.count ?? 0,
    watchlistCount: watchlistResult.count ?? 0,
    teamsScouted: uniqueClubs.size,
    countriesScouted: uniqueCountries.size,
  }
}

export async function getRecentActivity(limit = 20): Promise<ActivityWithDetails[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action_type, created_at, profiles(full_name), players(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Failed to fetch recent activity.')
  return data as unknown as ActivityWithDetails[]
}

export async function getTopPerformers(limit = 5): Promise<TopPerformer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, position, current_club, stats_goals, stats_assists')
    .neq('status', 'archived')
    .order('stats_goals', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error('Failed to fetch top performers.')
  return data as TopPerformer[]
}

export async function getRecentProspects(limit = 5): Promise<RecentProspect[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, nationality, date_of_birth, created_at')
    .eq('status', 'watchlist')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error('Failed to fetch recent prospects.')
  return data as RecentProspect[]
}

export async function getPositionalPipeline(): Promise<{ position: string; count: number }[]> {
  const { data, error } = await supabase
    .from('players')
    .select('position')
    .neq('status', 'archived')
    .not('position', 'is', null)

  if (error) throw new Error('Failed to fetch positional pipeline.')

  const counts: Record<string, number> = {}
  data.forEach((row) => {
    const pos = row.position?.trim()
    if (pos) {
      counts[pos] = (counts[pos] || 0) + 1
    }
  })

  // Convert to array and sort by count desc
  return Object.entries(counts)
    .map(([position, count]) => ({ position, count }))
    .sort((a, b) => b.count - a.count)
}
