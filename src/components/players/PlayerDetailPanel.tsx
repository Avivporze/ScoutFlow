import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ExternalLink, X } from 'lucide-react'
import { PlayerStatsCard } from './PlayerStatsCard'
import { SocialLinksDisplay } from './SocialLinksDisplay'
import { PlayerNotesTab } from './PlayerNotesTab'
import { PlayerActivityTab } from './PlayerActivityTab'
import { useAuth } from '@/hooks/useAuth'
import { useTeams } from '@/hooks/useTeams'
import { updatePlayer, deletePlayer } from '@/api/players'
import { Button } from '@/components/ui/Button'
import type { Player, SocialLinks } from '@/types/player'

interface Props {
  player: Player
  onClose: () => void
}

function computeAge(dob: string | null): string {
  if (!dob) return '—'
  const birth = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age--
  }
  return `${age} yrs`
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900">{value || '—'}</dd>
    </div>
  )
}

export function PlayerDetailPanel({ player, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'activity'>('overview')
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { teamsMap } = useTeams()
  const queryClient = useQueryClient()

  async function handleArchive() {
    try {
      await updatePlayer(player.id, { status: 'archived' })
      void queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success(t('toast.playerArchived'))
      onClose()
    } catch {
      toast.error(t('toast.error'))
    }
  }

  async function handleDelete() {
    if (!window.confirm(t('detail.confirmDelete'))) return
    try {
      await deletePlayer(player.id)
      void queryClient.invalidateQueries({ queryKey: ['players'] })
      toast.success(t('toast.playerDeleted'))
      onClose()
    } catch {
      toast.error(t('toast.error'))
    }
  }

  const socialLinks = (player.social_links ?? {}) as SocialLinks
  const teamName = player.best_fit_team_id ? teamsMap.get(player.best_fit_team_id) : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full sm:w-[480px] flex-col overflow-hidden bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-4 pb-2">
          <h2 className="text-lg font-semibold text-gray-900">
            {player.first_name} {player.last_name}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 gap-6 border-b border-gray-200 px-6 mt-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 pb-2 text-sm font-medium border-b-2 sm:flex-none ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {t('detail.overview', 'Overview')}
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 pb-2 text-sm font-medium border-b-2 sm:flex-none ${
              activeTab === 'notes'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {t('detail.notes', 'Notes')}
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 pb-2 text-sm font-medium border-b-2 sm:flex-none ${
              activeTab === 'activity'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            {t('detail.activity', 'Activity')}
          </button>
        </div>

        {/* Scrollable body */}
        {activeTab === 'overview' && (
          <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate(`/players/${player.id}/edit`)}>
                {t('detail.edit')}
              </Button>
              {player.status !== 'archived' && (
                <Button size="sm" variant="secondary" onClick={() => void handleArchive()}>
                  {t('detail.archive')}
                </Button>
              )}
              {profile?.role === 'admin' && (
                <Button size="sm" variant="danger" onClick={() => void handleDelete()}>
                  {t('detail.delete')}
                </Button>
              )}
            </div>

            {/* Stats */}
            <PlayerStatsCard player={player} />

            {/* Basic Info */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('playerForm.sections.basicInfo')}
              </h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label="Age" value={computeAge(player.date_of_birth)} />
                <Field label={t('playerForm.fields.nationality')} value={player.nationality} />
                <Field label={t('playerForm.fields.secondNationality')} value={player.second_nationality} />
                <Field label={t('playerForm.fields.preferredFoot')} value={player.preferred_foot} />
                <Field label={t('playerForm.fields.heightCm')} value={player.height_cm ? `${player.height_cm} cm` : null} />
                <Field label={t('playerForm.fields.weightKg')} value={player.weight_kg ? `${player.weight_kg} kg` : null} />
              </dl>
            </section>

            {/* Club & Position */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('playerForm.sections.clubPosition')}
              </h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label={t('playerForm.fields.currentClub')} value={player.current_club} />
                <Field label={t('playerForm.fields.league')} value={player.league} />
                <Field label={t('playerForm.fields.position')} value={player.position} />
                <Field label={t('playerForm.fields.contractExpiry')} value={player.contract_expiry} />
                <div className="col-span-2">
                  <Field label={t('playerForm.fields.marketValue')} value={player.market_value} />
                </div>
              </dl>
            </section>

            {/* Agent */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('playerForm.sections.agent')}
              </h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label={t('playerForm.fields.agentName')} value={player.agent_name} />
                <Field label={t('playerForm.fields.agentContact')} value={player.agent_contact} />
              </dl>
            </section>

            {/* Links & Social */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('playerForm.sections.linksSocial')}
              </h3>
              <div className="flex flex-col gap-3">
                {player.fbref_url && (
                  <a
                    href={player.fbref_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink size={14} />
                    FBref Profile
                  </a>
                )}
                {player.transfermarkt_url && (
                  <a
                    href={player.transfermarkt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <ExternalLink size={14} />
                    Transfermarkt Profile
                  </a>
                )}
                <SocialLinksDisplay links={socialLinks} />
              </div>
            </section>

            {/* Internal Scouting */}
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
                {t('playerForm.sections.internal')}
              </h3>
              <dl className="grid grid-cols-2 gap-3">
                <Field label={t('playerForm.fields.bestFitTeam')} value={teamName} />
                <Field label={t('playerForm.fields.status')} value={player.status} />
              </dl>
            </section>
          </div>
        )}

        {activeTab === 'notes' && <PlayerNotesTab playerId={player.id} />}
        {activeTab === 'activity' && <PlayerActivityTab playerId={player.id} />}
      </div>
    </>
  )
}
