import { supabase } from '@/api/supabase'
import type { InternalTeam } from '@/types/team'

export async function getTeams(): Promise<InternalTeam[]> {
  const { data, error } = await supabase
    .from('internal_teams')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}
