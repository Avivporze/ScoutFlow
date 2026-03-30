import type { Database } from './database'

export type Player = Database['public']['Tables']['players']['Row']
export type PlayerInsert = Database['public']['Tables']['players']['Insert']
export type PlayerUpdate = Database['public']['Tables']['players']['Update']

export interface SocialLinks {
  instagram?: string
  twitter?: string
  facebook?: string
  tiktok?: string
  linkedin?: string
  youtube?: string
  website?: string
}

export type PlayerWithSocial = Omit<Player, 'social_links'> & {
  social_links: SocialLinks
}
