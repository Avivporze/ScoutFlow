// src/pages/DashboardPage.tsx
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronRight, MessageSquare, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useDashboardStats, useRecentActivity } from '@/hooks/useDashboard'
import type { ActivityWithDetails } from '@/api/dashboard'

// Maps DB action_type values to human-readable verb phrases.
// "note_added" uses "added a note on" so the player name reads naturally after it.
const ACTION_LABELS: Record<ActivityWithDetails['action_type'], string> = {
  player_added: 'added',
  player_updated: 'updated',
  note_added: 'added a note on',
  player_archived: 'archived',
}

function getPlayerName(entry: ActivityWithDetails): string {
  if (!entry.players) return 'a player'
  return `${entry.players.first_name} ${entry.players.last_name}`
}

function buildActionLabel(entry: ActivityWithDetails): string {
  return `${ACTION_LABELS[entry.action_type]} ${getPlayerName(entry)}`
}

export function DashboardPage() {
  const { stats, isLoading: statsLoading } = useDashboardStats()
  const { activity, isLoading: activityLoading } = useRecentActivity(20)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>

      {/* ── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Total Players */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <Users size={20} className="text-blue-600" />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats.totalPlayers}</p>
              )}
              <p className="text-sm text-gray-500">Total Players</p>
            </div>
          </div>
        </div>

        {/* Recent Notes */}
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <MessageSquare size={20} className="text-blue-600" />
            </div>
            <div>
              {statsLoading ? (
                <div className="h-7 w-14 animate-pulse rounded bg-gray-100" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stats.recentNotesCount}</p>
              )}
              <p className="text-sm text-gray-500">Notes (last 7 days)</p>
            </div>
          </div>
        </div>

        {/* Contract Alerts — amber + clickable */}
        <Link
          to="/players?filter=contract_alert"
          className="group rounded-lg border border-amber-200 bg-amber-50 p-5 transition-colors hover:bg-amber-100"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 transition-colors group-hover:bg-amber-200">
                <AlertTriangle size={20} className="text-amber-600" />
              </div>
              <div>
                {statsLoading ? (
                  <div className="h-7 w-14 animate-pulse rounded bg-amber-100" />
                ) : (
                  <p
                    className={`text-2xl font-bold ${
                      stats.contractAlertsCount > 0 ? 'text-amber-700' : 'text-gray-400'
                    }`}
                  >
                    {stats.contractAlertsCount}
                  </p>
                )}
                <p className="text-sm text-amber-700">Contract Alerts</p>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="flex-shrink-0 text-amber-400 transition-colors group-hover:text-amber-600"
            />
          </div>
        </Link>
      </div>

      {/* ── Activity Feed ─────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Recent Activity
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
            <p className="py-4 text-center text-sm text-gray-400">No activity yet.</p>
          ) : (
            <div className="relative ml-1.5 border-l border-gray-200">
              {activity.map((entry) => (
                <div key={entry.id} className="mb-5 ml-4 last:mb-0">
                  {/* Timeline dot — sits on the left border */}
                  <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full border-2 border-white bg-blue-500" />
                  <p className="text-xs text-gray-400">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </p>
                  <p className="mt-0.5 text-sm text-gray-900">
                    <span className="font-medium">
                      {entry.profiles?.full_name ?? 'System'}
                    </span>{' '}
                    <span className="text-gray-600">{buildActionLabel(entry)}</span>
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
