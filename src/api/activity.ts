import { supabase } from './supabase'
import type { ActivityLogEntry } from '@/types/activity'

export interface ActivityWithUser extends ActivityLogEntry {
  profiles: {
    full_name: string
    avatar_url: string | null
  } | null
}

export async function getPlayerActivity(playerId: string): Promise<ActivityWithUser[]> {
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles(full_name, avatar_url)')
    .eq('player_id', playerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as unknown as ActivityWithUser[]
}
