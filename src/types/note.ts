import type { Database } from './database'

export type Note = Database['public']['Tables']['player_notes']['Row']
export type NoteInsert = Database['public']['Tables']['player_notes']['Insert']
