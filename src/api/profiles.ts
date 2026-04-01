import { supabase } from '@/api/supabase'
import type { Profile } from '@/types/database'

export async function getProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at')
  if (error) {
    console.error('[getProfiles]', error)
    throw error
  }
  return data
}

export async function updateProfile(
  id: string,
  updates: { full_name?: string; preferred_language?: 'en' | 'es'; avatar_url?: string | null },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('[updateProfile]', error)
    throw error
  }
  return data
}

export async function updateProfileRole(
  id: string,
  role: 'admin' | 'scout',
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('[updateProfileRole]', error)
    throw error
  }
  return data
}
