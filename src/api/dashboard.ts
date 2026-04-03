import { supabase } from './supabase'
import type { Player } from '@/types/player'
import { parseMarketValue } from '@/lib/marketValueParser'

export interface DashboardStats {
  totalPlayers: number
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

export interface ExpiringContract {
  id: string
  first_name: string
  last_name: string
  position: string | null
  current_club: string | null
  contract_expiry: string // non-null guaranteed by query filter
}

export interface MarketValuePlayer {
  id: string
  first_name: string
  last_name: string
  position: string | null
  current_club: string | null
  market_value: string // non-null guaranteed by query filter
}

export interface ScoutingGapPlayer {
  id: string
  first_name: string
  last_name: string
  position: string | null
  created_at: string
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [playersResult, clubResult, nationalityResult] = await Promise.all([
    supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .neq('status', 'archived'),
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

  if (playersResult.error || clubResult.error || nationalityResult.error) {
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
    teamsScouted: uniqueClubs.size,
    countriesScouted: uniqueCountries.size,
  }
}

export async function getRecentActivity(limit = 20): Promise<ActivityWithDetails[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('activity_log')
    .select('id, action_type, created_at, profiles(full_name), players(first_name, last_name)')
    .eq('user_id', user.id)
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


export async function getExpiringContracts(limit = 5): Promise<ExpiringContract[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, position, current_club, contract_expiry')
    .neq('status', 'archived')
    .not('contract_expiry', 'is', null)
    .order('contract_expiry', { ascending: true, nullsFirst: false })
    .limit(limit)

  if (error) throw new Error('Failed to fetch expiring contracts.')
  return data as ExpiringContract[]
}

export async function getHighestMarketValue(limit = 5): Promise<MarketValuePlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, first_name, last_name, position, current_club, market_value')
    .neq('status', 'archived')
    .not('market_value', 'is', null)
    .neq('market_value', '-')
    .neq('market_value', '')

  if (error) throw new Error('Failed to fetch market values.')

  return (data as MarketValuePlayer[])
    .filter((p) => parseMarketValue(p.market_value) > 0)
    .sort((a, b) => parseMarketValue(b.market_value) - parseMarketValue(a.market_value))
    .slice(0, limit)
}

export async function getScoutingGapCount(): Promise<number> {
  // Step 1: player_ids the current user has noted (RLS on player_notes enforces author_id = auth.uid())
  const { data: notesData, error: notesError } = await supabase
    .from('player_notes')
    .select('player_id')

  if (notesError) throw new Error('Failed to fetch player notes.')
  const notedIds = new Set((notesData ?? []).map((n) => n.player_id))

  // Step 2: all non-archived players with the fields needed to evaluate both conditions
  type GapPlayer = { id: string; market_value: string | null; contract_expiry: string | null }
  const { data, error } = await supabase
    .from('players')
    .select('id, market_value, contract_expiry')
    .neq('status', 'archived')

  if (error) throw new Error('Failed to fetch players for scouting gap count.')

  // A player "needs attention" if: (a) current user has no notes on them, OR (b) missing critical data
  return (data as GapPlayer[]).filter(
    (p) => !notedIds.has(p.id) || p.market_value === null || p.contract_expiry === null,
  ).length
}

export async function getScoutingGaps(limit = 5): Promise<ScoutingGapPlayer[]> {
  // Step 1: fetch player_ids the current user has ever noted.
  // RLS on player_notes enforces author_id = auth.uid(), so this is already user-scoped.
  const { data: notesData, error: notesError } = await supabase
    .from('player_notes')
    .select('player_id')

  if (notesError) throw new Error('Failed to fetch player notes.')

  const notedIds = [...new Set((notesData ?? []).map((n) => n.player_id))]

  // Step 2: fetch non-archived players, excluding those already noted.
  let query = supabase
    .from('players')
    .select('id, first_name, last_name, position, created_at')
    .neq('status', 'archived')
    .order('created_at', { ascending: true })
    .limit(limit)

  if (notedIds.length > 0) {
    query = query.not('id', 'in', `(${notedIds.join(',')})`)
  }

  const { data, error } = await query
  if (error) throw new Error('Failed to fetch scouting gaps.')
  return data as ScoutingGapPlayer[]
}

