import { supabase } from './supabase'
import type { Note, NoteInsert } from '@/types/note'

export interface NoteWithAuthor extends Note {
  profiles: {
    full_name: string
    avatar_url: string | null
  } | null
}

export async function getPlayerNotes(playerId: string): Promise<NoteWithAuthor[]> {
  const { data, error } = await supabase
    .from('player_notes')
    .select('*, profiles(full_name, avatar_url)')
    .eq('player_id', playerId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as unknown as NoteWithAuthor[]
}

export async function addNote(note: NoteInsert): Promise<Note> {
  const { data, error } = await supabase
    .from('player_notes')
    .insert(note)
    .select()
    .single()

  if (error) throw error
  return data
}
