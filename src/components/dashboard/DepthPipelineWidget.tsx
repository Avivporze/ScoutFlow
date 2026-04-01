import { useTranslation } from 'react-i18next'
import { Layers } from 'lucide-react'
import { usePositionalPipeline } from '@/hooks/useDashboard'

const getPositionColor = (pos: string) => {
  const p = pos.toUpperCase()
  if (p === 'GK') return 'bg-yellow-400'
  if (['CB', 'RB', 'LB'].includes(p)) return 'bg-blue-500'
  if (['CDM', 'CM', 'CAM', 'RM', 'LM'].includes(p)) return 'bg-emerald-500'
  if (['RW', 'LW', 'ST', 'CF'].includes(p)) return 'bg-rose-500'
  return 'bg-gray-400'
}

export function DepthPipelineWidget() {
  const { t } = useTranslation()
  const { pipeline, isLoading } = usePositionalPipeline()

  const total = pipeline.reduce((sum, item) => sum + item.count, 0)

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm flex flex-col">
      <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4">
        <Layers className="h-5 w-5 text-indigo-500" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          {t('dashboard.pipeline')}
        </h2>
      </div>
      <div className="p-5 flex-1 min-h-[250px] flex flex-col justify-center">
        {isLoading ? (
          <div className="space-y-4 w-full">
            <div className="h-8 w-full animate-pulse rounded-full bg-gray-100" />
            <div className="grid grid-cols-2 gap-3 mt-6 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-gray-100" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        ) : pipeline.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-400">{t('dashboard.noActivity')}</p>
          </div>
        ) : (
          <div className="w-full">
            {/* Segmented Bar */}
            <div className="relative flex h-8 w-full overflow-hidden rounded-full bg-gray-100 ring-1 ring-inset ring-gray-200 shadow-inner">
              {pipeline.map((item) => {
                const percentage = total > 0 ? (item.count / total) * 100 : 0
                return (
                  <div
                    key={item.position}
                    style={{ width: `${percentage}%` }}
                    className={`h-full ${getPositionColor(item.position)} transition-all duration-500 hover:opacity-90 border-r border-white/20 last:border-r-0 flex items-center justify-center overflow-hidden cursor-default`}
                    title={`${t(`positions.${item.position}`, { defaultValue: item.position })}: ${item.count} (${percentage.toFixed(1)}%)`}
                  >
                    {percentage > 10 && (
                      <span className="text-[10px] font-bold text-white drop-shadow-md px-1 truncate">
                        {item.position}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {pipeline.map((item) => (
                <div key={item.position} className="flex items-center gap-2 text-sm group">
                  <span className={`block h-3 w-3 shrink-0 rounded-full ${getPositionColor(item.position)} shadow-sm ring-1 ring-black/5`} />
                  <span 
                    className="font-medium text-gray-700 truncate group-hover:text-gray-900 transition-colors" 
                    title={t(`positions.${item.position}`, { defaultValue: item.position })}
                  >
                    {t(`positions.${item.position}`, { defaultValue: item.position })}
                  </span>
                  <span className="text-gray-400 ml-auto tabular-nums pr-1">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
