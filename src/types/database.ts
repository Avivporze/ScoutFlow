/**
 * Hand-written Database type that mirrors the Supabase schema.
 * Replace this file by running:
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          role: 'admin' | 'scout'
          preferred_language: 'en' | 'es'
          avatar_url: string | null
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          role?: 'admin' | 'scout'
          preferred_language?: 'en' | 'es'
          avatar_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string
          role?: 'admin' | 'scout'
          preferred_language?: 'en' | 'es'
          avatar_url?: string | null
          created_at?: string
        }
        Relationships: []
      }
      internal_teams: {
        Row: {
          id: string
          team_name: string
          league: string | null
          country: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          team_name: string
          league?: string | null
          country?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          team_name?: string
          league?: string | null
          country?: string | null
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          id: string
          first_name: string
          last_name: string
          date_of_birth: string | null
          nationality: string | null
          second_nationality: string | null
          preferred_foot: 'Left' | 'Right' | 'Both' | null
          height_cm: number | null
          weight_kg: number | null
          current_club: string | null
          league: string | null
          position: string | null
          contract_expiry: string | null
          market_value: string | null
          agent_name: string | null
          agent_contact: string | null
          transfermarkt_url: string | null
          fbref_url: string | null
          social_links: Json
          stats_matches: number
          stats_goals: number
          stats_assists: number
          stats_minutes: number
          stats_updated_at: string | null
          best_fit_team_id: string | null
          status: 'active' | 'archived' | 'watchlist'
          added_by: string
          created_at: string
          updated_at: string
          sort_order: number
        }
        Insert: {
          id?: string
          first_name: string
          last_name: string
          date_of_birth?: string | null
          nationality?: string | null
          second_nationality?: string | null
          preferred_foot?: 'Left' | 'Right' | 'Both' | null
          height_cm?: number | null
          weight_kg?: number | null
          current_club?: string | null
          league?: string | null
          position?: string | null
          contract_expiry?: string | null
          market_value?: string | null
          agent_name?: string | null
          agent_contact?: string | null
          transfermarkt_url?: string | null
          fbref_url?: string | null
          social_links?: Json
          best_fit_team_id?: string | null
          status?: 'active' | 'archived' | 'watchlist'
          added_by?: string
          created_at?: string
          updated_at?: string
          sort_order?: number
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          date_of_birth?: string | null
          nationality?: string | null
          second_nationality?: string | null
          preferred_foot?: 'Left' | 'Right' | 'Both' | null
          height_cm?: number | null
          weight_kg?: number | null
          current_club?: string | null
          league?: string | null
          position?: string | null
          contract_expiry?: string | null
          market_value?: string | null
          agent_name?: string | null
          agent_contact?: string | null
          transfermarkt_url?: string | null
          fbref_url?: string | null
          social_links?: Json
          best_fit_team_id?: string | null
          status?: 'active' | 'archived' | 'watchlist'
          added_by?: string
          created_at?: string
          updated_at?: string
          sort_order?: number
        }
        Relationships: []
      }
      player_notes: {
        Row: {
          id: string
          player_id: string
          author_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          player_id: string
          author_id?: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          player_id?: string
          author_id?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          id: string
          user_id: string | null
          player_id: string | null
          action_type: 'player_added' | 'player_updated' | 'note_added' | 'player_archived'
          metadata: Json
          created_at: string
        }
        // Read-only: all writes go through SECURITY DEFINER triggers — never insert/update from frontend
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience row types
export type Profile = Database['public']['Tables']['profiles']['Row']
