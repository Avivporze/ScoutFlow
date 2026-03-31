import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getPlayerNotes, addNote } from '@/api/notes'
import { supabase } from '@/api/supabase'

export function useNotes(playerId: string) {
  const queryClient = useQueryClient()
  const queryKey = ['notes', playerId]

  const query = useQuery({
    queryKey,
    queryFn: () => getPlayerNotes(playerId),
  })

  useEffect(() => {
    if (!playerId) return

    const channel = supabase
      .channel(`notes-for-${playerId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'player_notes',
          filter: `player_id=eq.${playerId}`
        },
        async (payload: any) => {
          // Fetch the single inserted note to resolve the profile join
          const { data } = await supabase
            .from('player_notes')
            .select('*, profiles(full_name, avatar_url)')
            .eq('id', payload.new.id)
            .single()

          if (data) {
            const insertedRecord = data as any;
            queryClient.setQueryData(queryKey, (old: any) => {
              if (!old || old.length === 0) return [insertedRecord]
              // Prevent duplicates if this client initiated the insertion
              if (old.some((n: any) => n.id === insertedRecord.id)) return old
              return [...old, insertedRecord]
            })
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [playerId, queryClient, queryKey])

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => addNote({ player_id: playerId, content }),
    onSuccess: () => {
      // We rely on the Supabase Realtime subscription above to append the note locally
    }
  })

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    addNote: addNoteMutation.mutateAsync,
    isAddingNote: addNoteMutation.isPending
  }
}
