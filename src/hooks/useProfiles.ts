import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProfiles, updateProfile, updateProfileRole } from '@/api/profiles'
import type { Profile } from '@/types/database'

export function useProfiles() {
  const { data, isPending, error } = useQuery<Profile[], Error>({
    queryKey: ['profiles'],
    queryFn: getProfiles,
    staleTime: 5 * 60_000,
  })
  return { profiles: data ?? [], isLoading: isPending, error }
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string
      updates: { full_name?: string; preferred_language?: 'en' | 'es'; avatar_url?: string | null }
    }) => updateProfile(id, updates),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'admin' | 'scout' }) =>
      updateProfileRole(id, role),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profiles'] })
    },
  })
}
