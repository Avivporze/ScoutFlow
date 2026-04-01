import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  X,
} from 'lucide-react'
import {
  useTeams,
  useAddTeam,
  useUpdateTeam,
  useDeleteTeam,
  useSwapTeamOrder,
} from '@/hooks/useTeams'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface EditingTeam {
  id: string
  team_name: string
  league: string
  country: string
}

export function TeamManagementSection() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { teams, isLoading } = useTeams()
  const addTeam = useAddTeam()
  const updateTeam = useUpdateTeam()
  const deleteTeam = useDeleteTeam()
  const swapOrder = useSwapTeamOrder()

  const isAdmin = profile?.role === 'admin'

  // Add form state
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLeague, setNewLeague] = useState('')
  const [newCountry, setNewCountry] = useState('')

  // Edit state
  const [editing, setEditing] = useState<EditingTeam | null>(null)

  if (!isAdmin) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {t('settings.teams.title')}
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          {t('settings.teams.adminOnly')}
        </p>
      </div>
    )
  }

  function handleAdd() {
    if (!newName.trim()) return
    const maxOrder = teams.reduce((max, t) => Math.max(max, t.sort_order), 0)
    addTeam.mutate(
      {
        team_name: newName.trim(),
        league: newLeague.trim() || null,
        country: newCountry.trim() || null,
        sort_order: maxOrder + 1,
      },
      {
        onSuccess: () => {
          toast.success(t('settings.teams.added'))
          setNewName('')
          setNewLeague('')
          setNewCountry('')
          setShowAdd(false)
        },
        onError: () => toast.error(t('toast.error')),
      },
    )
  }

  function handleUpdate() {
    if (!editing || !editing.team_name.trim()) return
    updateTeam.mutate(
      {
        id: editing.id,
        updates: {
          team_name: editing.team_name.trim(),
          league: editing.league.trim() || null,
          country: editing.country.trim() || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(t('settings.teams.updated'))
          setEditing(null)
        },
        onError: () => toast.error(t('toast.error')),
      },
    )
  }

  function handleDelete(id: string) {
    if (!confirm(t('settings.teams.confirmDelete'))) return
    deleteTeam.mutate(id, {
      onSuccess: () => toast.success(t('settings.teams.deleted')),
      onError: () => toast.error(t('toast.error')),
    })
  }

  function handleSwap(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= teams.length) return
    swapOrder.mutate({
      teamA: { id: teams[index].id, sort_order: teams[index].sort_order },
      teamB: { id: teams[targetIndex].id, sort_order: teams[targetIndex].sort_order },
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t('settings.teams.title')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t('settings.teams.description')}
          </p>
        </div>
        {!showAdd && (
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={16} />
            {t('settings.teams.addTeam')}
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Input
              placeholder={t('settings.teams.teamName')}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
            />
            <Input
              placeholder={t('settings.teams.league')}
              value={newLeague}
              onChange={e => setNewLeague(e.target.value)}
            />
            <Input
              placeholder={t('settings.teams.country')}
              value={newCountry}
              onChange={e => setNewCountry(e.target.value)}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={handleAdd} loading={addTeam.isPending} disabled={!newName.trim()}>
              {t('settings.teams.addTeam')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Teams Table */}
      <div className="mt-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
            {t('common.loading')}
          </div>
        ) : teams.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            {t('settings.teams.noTeams')}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                    {t('settings.teams.teamName')}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                    {t('settings.teams.league')}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                    {t('settings.teams.country')}
                  </th>
                  <th className="w-36 px-4 py-2.5 text-right font-medium text-gray-600" />
                </tr>
              </thead>
              <tbody>
                {teams.map((team, index) => (
                  <tr
                    key={team.id}
                    className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                  >
                    {editing?.id === team.id ? (
                      // Editing row
                      <>
                        <td className="px-4 py-2">
                          <input
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editing.team_name}
                            onChange={e => setEditing({ ...editing, team_name: e.target.value })}
                            autoFocus
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editing.league}
                            onChange={e => setEditing({ ...editing, league: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={editing.country}
                            onChange={e => setEditing({ ...editing, country: e.target.value })}
                          />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={handleUpdate}
                              className="rounded p-1 text-green-600 hover:bg-green-50 transition-colors"
                              title="Save"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // Display row
                      <>
                        <td className="px-4 py-2.5 font-medium text-gray-900">
                          {team.team_name}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {team.league || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {team.country || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleSwap(index, 'up')}
                              disabled={index === 0}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title={t('settings.teams.moveUp')}
                            >
                              <ChevronUp size={16} />
                            </button>
                            <button
                              onClick={() => handleSwap(index, 'down')}
                              disabled={index === teams.length - 1}
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              title={t('settings.teams.moveDown')}
                            >
                              <ChevronDown size={16} />
                            </button>
                            <button
                              onClick={() =>
                                setEditing({
                                  id: team.id,
                                  team_name: team.team_name,
                                  league: team.league || '',
                                  country: team.country || '',
                                })
                              }
                              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(team.id)}
                              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
