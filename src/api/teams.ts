import { supabase } from '@/api/supabase'
import type { InternalTeam, InternalTeamInsert, InternalTeamUpdate } from '@/types/team'

export async function getTeams(): Promise<InternalTeam[]> {
  const { data, error } = await supabase
    .from('internal_teams')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function addTeam(team: InternalTeamInsert): Promise<InternalTeam> {
  const { data, error } = await supabase
    .from('internal_teams')
    .insert(team)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export async function updateTeam(id: string, updates: InternalTeamUpdate): Promise<InternalTeam> {
  const { data, error } = await supabase
    .from('internal_teams')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    throw error
  }
  return data
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from('internal_teams').delete().eq('id', id)
  if (error) {
    throw error
  }
}

/**
 * Swap sort_order between two teams (for up/down reorder buttons).
 * Performs two sequential updates — not atomic, but fine for a small team app.
 */
export async function swapTeamOrder(
  teamA: { id: string; sort_order: number },
  teamB: { id: string; sort_order: number },
): Promise<void> {
  const { error: e1 } = await supabase
    .from('internal_teams')
    .update({ sort_order: teamB.sort_order })
    .eq('id', teamA.id)
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('internal_teams')
    .update({ sort_order: teamA.sort_order })
    .eq('id', teamB.id)
  if (e2) throw e2
}
