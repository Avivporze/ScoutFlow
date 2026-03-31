import { supabase } from '@/api/supabase'
import type { Player, PlayerInsert, PlayerUpdate } from '@/types/player'

export async function getPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function addPlayer(player: PlayerInsert): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert(player)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePlayer(id: string, updates: PlayerUpdate): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from('players').delete().eq('id', id)
  if (error) throw error
}
