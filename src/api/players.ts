import { supabase } from '@/api/supabase'
import type { Player, PlayerInsert, PlayerUpdate } from '@/types/player'

// ── Advanced filter types ───────────────────────────────────────────────────

export interface PlayerFilters {
  search?: string
  position?: string      // comma-separated, e.g. "CM,CDM"
  status?: string        // comma-separated, e.g. "active,watchlist"
  foot?: string          // "Left" | "Right" | "Both"
  nationality?: string   // ilike match
  league?: string        // ilike match
  minAge?: number
  maxAge?: number
  minGoals?: number
  maxGoals?: number
  minAssists?: number
  maxAssists?: number
  minMatches?: number
  maxMatches?: number
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Sanitize strings to prevent PostgREST injection through the Supabase SDK.
 * Strips commas, parens, quotes, percent signs, and backslashes.
 */
function sanitizePostgrestFilter(val: string): string {
  return val.replace(/[,()"%'\\]/g, '').trim()
}

export async function filterPlayers(filters: PlayerFilters): Promise<Player[]> {
  let query = supabase.from('players').select('*')

  if (filters.search?.trim()) {
    const s = sanitizePostgrestFilter(filters.search)
    if (s) {
      query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%`)
    }
  }

  if (filters.position) {
    query = query.in('position', filters.position.split(','))
  }

  if (filters.status) {
    query = query.in('status', filters.status.split(',') as any[])
  }

  if (filters.foot) {
    query = query.eq('preferred_foot', filters.foot as any)
  }

  if (filters.nationality?.trim()) {
    const nat = sanitizePostgrestFilter(filters.nationality)
    if (nat) {
      query = query.ilike('nationality', `%${nat}%`)
    }
  }

  if (filters.league?.trim()) {
    const lg = sanitizePostgrestFilter(filters.league)
    if (lg) {
      query = query.ilike('league', `%${lg}%`)
    }
  }

  // Age → date_of_birth bounds
  const today = new Date()
  if (filters.maxAge !== undefined) {
    // age <= maxAge → DOB >= (today - maxAge - 1 years + 1 day)
    const minDOB = new Date(today.getFullYear() - filters.maxAge - 1, today.getMonth(), today.getDate() + 1)
    query = query.gte('date_of_birth', toISODate(minDOB))
  }
  if (filters.minAge !== undefined) {
    // age >= minAge → DOB <= (today - minAge years)
    const maxDOB = new Date(today.getFullYear() - filters.minAge, today.getMonth(), today.getDate())
    query = query.lte('date_of_birth', toISODate(maxDOB))
  }

  if (filters.minGoals !== undefined) query = query.gte('stats_goals', filters.minGoals)
  if (filters.maxGoals !== undefined) query = query.lte('stats_goals', filters.maxGoals)
  if (filters.minAssists !== undefined) query = query.gte('stats_assists', filters.minAssists)
  if (filters.maxAssists !== undefined) query = query.lte('stats_assists', filters.maxAssists)
  if (filters.minMatches !== undefined) query = query.gte('stats_matches', filters.minMatches)
  if (filters.maxMatches !== undefined) query = query.lte('stats_matches', filters.maxMatches)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return data
}

export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    throw error
  }
  return data
}

export async function addPlayer(player: PlayerInsert): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert(player)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export async function updatePlayer(id: string, updates: PlayerUpdate): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) {
    throw error
  }
}
