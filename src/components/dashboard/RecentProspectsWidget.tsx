import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { UsersRound, Calendar } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es as esLocale } from 'date-fns/locale'
import { useRecentProspects } from '@/hooks/useDashboard'

export function RecentProspectsWidget() {
  const { t, i18n } = useTranslation()
  const { players, isLoading } = useRecentProspects(5)
  const dateLocale = i18n.language.startsWith('es') ? esLocale : undefined

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <UsersRound className="h-5 w-5 text-emerald-500" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t('dashboard.recentlyAdded')}
        </h2>
      </div>
      <div className="p-5 flex-1 min-h-[250px]">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-16 animate-pulse rounded bg-gray-100" />
                </div>
                <div className="h-3 w-8 animate-pulse rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : players.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">{t('dashboard.noActivity')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {players.map((player) => {
              const initials = `${player.first_name[0] || ''}${player.last_name[0] || ''}`.toUpperCase()
              
              let ageStr = '?'
              if (player.date_of_birth) {
                const dob = new Date(player.date_of_birth)
                const ageDifMs = Date.now() - dob.getTime()
                const ageDate = new Date(ageDifMs)
                ageStr = Math.abs(ageDate.getUTCFullYear() - 1970).toString()
              }

              return (
                <Link
                  key={player.id}
                  to={`/players/${player.id}`}
                  className="group flex items-center justify-between gap-3 rounded-lg transition-colors hover:bg-gray-50 -mx-2 p-2"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 group-hover:text-emerald-600 transition-colors">
                        {player.first_name} {player.last_name}
                      </p>
                      <div className="flex items-center gap-1.5 truncate text-xs text-gray-500">
                        {player.nationality || t('positions.Unknown')} 
                        <span className="text-gray-300">•</span>
                        <span>{t('dashboard.age')} {ageStr}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                    <Calendar className="h-3 w-3" />
                    <span className="whitespace-nowrap">
                      {formatDistanceToNow(new Date(player.created_at), { addSuffix: true, locale: dateLocale })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
