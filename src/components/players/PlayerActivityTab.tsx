import { useTranslation } from 'react-i18next'
import { useActivity } from '@/hooks/useActivity'
import { format } from 'date-fns'

interface Props {
  playerId: string
}

export function PlayerActivityTab({ playerId }: Props) {
  const { t } = useTranslation()
  const { activityLog, isLoading } = useActivity(playerId)

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500">{t('common.loading', 'Loading...')}</div>
  }

  if (activityLog.length === 0) {
    return <div className="p-6 text-center text-sm text-gray-500">No activity logged yet.</div>
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6">
      <div className="relative border-l border-gray-200 ml-3">
        {activityLog.map((log) => (
          <div key={log.id} className="mb-6 ml-4">
            <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-blue-500" />
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">
                {format(new Date(log.created_at), 'MMM d, yyyy h:mm a')}
              </span>
              <p className="mt-1 text-sm text-gray-900">
                <span className="font-semibold">{log.profiles?.full_name || 'System'}</span>
                {' '} — {' '}
                <span className="font-mono text-xs text-brand-600 bg-brand-50 rounded px-1 py-0.5">{log.action_type}</span>
              </p>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <pre className="mt-2 text-wrap overflow-x-auto rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 font-mono">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
