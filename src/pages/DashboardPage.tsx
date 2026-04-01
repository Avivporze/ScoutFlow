import { useTranslation } from 'react-i18next'
import { useDashboardStats, useRecentActivity } from '@/hooks/useDashboard'
import type { ActivityWithDetails } from '@/api/dashboard'
import { TopPerformersWidget } from '@/components/dashboard/TopPerformersWidget'
import { RecentProspectsWidget } from '@/components/dashboard/RecentProspectsWidget'
import { DepthPipelineWidget } from '@/components/dashboard/DepthPipelineWidget'
import { Users, Eye, Globe, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es as esLocale } from 'date-fns/locale'

export function DashboardPage() {
  const { t, i18n } = useTranslation()
  const { stats, isLoading: statsLoading } = useDashboardStats()
  const { activity, isLoading: activityLoading } = useRecentActivity(20)

  // Maps DB action_type → translated verb phrase
  const actionLabel = (entry: ActivityWithDetails): string => {
    const verb = t(`dashboard.actions.${entry.action_type}`)
    const name = entry.players
      ? `${entry.players.first_name} ${entry.players.last_name}`
      : t('dashboard.aPlayer')
    return `${verb} ${name}`
  }

  const dateLocale = i18n.language.startsWith('es') ? esLocale : undefined

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">{t('dashboard.title')}</h1>

      {/* ── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4">
        {/* Total Players */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats.totalPlayers}</p>
              )}
              <p className="text-sm font-medium text-gray-500">{t('dashboard.totalPlayers')}</p>
            </div>
          </div>
        </div>

        {/* Watchlist */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50 ring-1 ring-purple-100">
              <Eye size={20} className="text-purple-600" />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats.watchlistCount}</p>
              )}
              <p className="text-sm font-medium text-gray-500">{t('dashboard.watchlistCount')}</p>
            </div>
          </div>
        </div>

        {/* Countries Scouted */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100">
              <Globe size={20} className="text-emerald-600" />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats.countriesScouted}</p>
              )}
              <p className="text-sm font-medium text-gray-500">{t('dashboard.countriesScouted')}</p>
            </div>
          </div>
        </div>

        {/* Teams Scouted */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50 ring-1 ring-indigo-100">
              <Shield size={20} className="text-indigo-600" />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats.teamsScouted}</p>
              )}
              <p className="text-sm font-medium text-gray-500">{t('dashboard.teamsScouted')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dashboard Widgets ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <DepthPipelineWidget />
        <TopPerformersWidget />
        <RecentProspectsWidget />
      </div>

      {/* ── Activity Feed ─────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('dashboard.recentActivity')}
          </h2>
        </div>

        <div className="p-5">
          {activityLoading ? (
            // Skeleton rows
            <div className="space-y-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <div className="mt-1 h-3 w-3 flex-shrink-0 animate-pulse rounded-full bg-gray-100" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
                    <div className="h-3 w-52 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">{t('dashboard.noActivity')}</p>
          ) : (
            <div className="relative ml-1.5 border-l border-gray-200">
              {activity.map((entry) => (
                <div key={entry.id} className="mb-5 ml-4 last:mb-0">
                  {/* Timeline dot — sits on the left border */}
                  <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: dateLocale })}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-900">
                    <span className="font-medium">
                      {entry.profiles?.full_name ?? t('dashboard.system')}
                    </span>{' '}
                    <span className="text-gray-600">{actionLabel(entry)}</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
