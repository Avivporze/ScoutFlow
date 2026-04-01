import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { useTopPerformers } from '@/hooks/useDashboard'

export function TopPerformersWidget() {
  const { t } = useTranslation()
  const { players, isLoading } = useTopPerformers(5)

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <Trophy className="h-5 w-5 text-amber-500" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t('dashboard.topPerformers')}
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
                  <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded-full bg-gray-100" />
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
              const goals = player.stats_goals ?? 0
              const assists = player.stats_assists ?? 0
              const initials = `${player.first_name[0] || ''}${player.last_name[0] || ''}`.toUpperCase()

              return (
                <Link
                  key={player.id}
                  to={`/players/${player.id}`}
                  className="group flex items-center justify-between gap-3 rounded-lg transition-colors hover:bg-gray-50 -mx-2 p-2"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-amber-700 ring-1 ring-amber-100">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 group-hover:text-amber-600 transition-colors">
                        {player.first_name} {player.last_name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {player.position ? t(`positions.${player.position}`) : t('positions.Unknown')} • {player.current_club || 'No Club'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700">
                    <span title={t('dashboard.goals')}>{goals} {t('dashboard.goals')[0]}</span>
                    <span className="text-stone-300">|</span>
                    <span title={t('dashboard.assists')}>{assists} {t('dashboard.assists')[0]}</span>
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
