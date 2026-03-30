import type { Database } from './database'

export type InternalTeam = Database['public']['Tables']['internal_teams']['Row']
export type InternalTeamInsert = Database['public']['Tables']['internal_teams']['Insert']
export type InternalTeamUpdate = Database['public']['Tables']['internal_teams']['Update']
