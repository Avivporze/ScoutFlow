import type { Database } from './database'

export type ActivityLogEntry = Database['public']['Tables']['activity_log']['Row']
