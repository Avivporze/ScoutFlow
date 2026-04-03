import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CalendarX } from 'lucide-react'
import { differenceInCalendarMonths } from 'date-fns'
import { useExpiringContracts } from '@/hooks/useDashboard'

function getContractBadgeClass(monthsLeft: number): string {
  if (monthsLeft <= 3) return 'bg-red-100 text-red-700'
  if (monthsLeft <= 6) return 'bg-orange-100 text-orange-700'
  return 'bg-emerald-100 text-emerald-700'
}

export function ExpiringContractsWidget() {
  const { t } = useTranslation()
  const { contracts, isLoading } = useExpiringContracts(5)

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <CalendarX className="h-5 w-5 text-orange-500" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t('dashboard.expiringContracts')}
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
        ) : contracts.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">{t('dashboard.noExpiringContracts')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contracts.map((player) => {
              const initials = `${player.first_name[0] ?? ''}${player.last_name[0] ?? ''}`.toUpperCase()
              const monthsLeft = differenceInCalendarMonths(
                new Date(player.contract_expiry),
                new Date(),
              )

              return (
                <Link
                  key={player.id}
                  to={`/players/${player.id}`}
                  className="group flex items-center justify-between gap-3 rounded-lg transition-colors hover:bg-gray-50 -mx-2 p-2"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-sm font-semibold text-orange-700 ring-1 ring-orange-100">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900 group-hover:text-orange-600 transition-colors">
                        {player.first_name} {player.last_name}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {player.position ? t(`positions.${player.position}`) : t('positions.Unknown')}
                        {player.current_club && <span> • {player.current_club}</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${getContractBadgeClass(monthsLeft)}`}>
                    {monthsLeft} {t('dashboard.monthsLeft')}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
