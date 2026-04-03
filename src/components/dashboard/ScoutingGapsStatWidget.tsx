import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import { useScoutingGapCount } from '@/hooks/useDashboard'

export function ScoutingGapsStatWidget() {
  const { t } = useTranslation()
  const { count, isLoading } = useScoutingGapCount()

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-orange-50 ring-1 ring-orange-100">
          <TriangleAlert size={20} className="text-orange-600" />
        </div>
        <div>
          {isLoading ? (
            <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
          ) : (
            <p className="text-2xl font-bold text-gray-900">{count}</p>
          )}
          <p className="text-sm font-medium text-gray-500">{t('dashboard.scoutingGaps')}</p>
        </div>
      </div>
    </div>
  )
}
