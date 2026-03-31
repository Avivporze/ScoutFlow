import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useNotes } from '@/hooks/useNotes'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  playerId: string
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

export function PlayerNotesTab({ playerId }: Props) {
  const { t } = useTranslation()
  const { notes, isLoading, addNote, isAddingNote } = useNotes(playerId)
  const [content, setContent] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [notes])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return

    try {
      await addNote(content.trim())
      setContent('')
    } catch {
      toast.error(t('toast.error'))
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">{t('common.loading', 'Loading...')}</div>
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6" ref={scrollRef}>
        {notes.length === 0 ? (
          <div className="text-center text-sm text-gray-500">
            {t('detail.noNotes', 'No notes yet. Start the discussion!')}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {notes.map((note) => (
              <div key={note.id} className="flex gap-3">
                {note.profiles?.avatar_url ? (
                  <img src={note.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full bg-gray-100 object-cover" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                    {note.profiles?.full_name ? getInitials(note.profiles.full_name) : '?'}
                  </div>
                )}
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {note.profiles?.full_name || 'Unknown'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{note.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-gray-50 p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('detail.addNotePlaceholder', 'Write a note...')}
            className="w-full resize-none rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={!content.trim() || isAddingNote}>
              {isAddingNote ? t('common.saving', 'Saving...') : t('detail.postNote', 'Post Note')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
