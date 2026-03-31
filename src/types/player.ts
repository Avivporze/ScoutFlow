import type { Database } from './database'

export type Player = Database['public']['Tables']['players']['Row']
export type PlayerInsert = Database['public']['Tables']['players']['Insert']
export type PlayerUpdate = Database['public']['Tables']['players']['Update']

export interface SocialLinks {
  instagram?: string
  youtube?: string
}

export type PlayerWithSocial = Omit<Player, 'social_links'> & {
  social_links: SocialLinks
}

export type PlayerStats = Pick<
  Player,
  'stats_matches' | 'stats_goals' | 'stats_assists' | 'stats_minutes' | 'stats_updated_at'
>
