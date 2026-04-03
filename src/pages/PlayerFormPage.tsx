import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { addPlayer, updatePlayer } from '@/api/players'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { POSITIONS, PREFERRED_FOOT_OPTIONS, PLAYER_STATUS_OPTIONS, ISRAELI_PREMIER_LEAGUE_TEAMS } from '@/lib/constants'
import { bestFitSchema } from '@/lib/schemas'
import type { PlayerInsert, PlayerUpdate, SocialLinks } from '@/types/player'

type FormErrors = Partial<Record<string, string>>

const SELECT_CLASS =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
  'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ' +
  'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500'

function isValidUrl(val: string): boolean {
  if (!val.trim()) return true
  try {
    new URL(val)
    return true
  } catch {
    return false
  }
}

/** Return trimmed string or null if blank — prevents sending "" to Postgres columns that expect date/int/uuid. */
function orNull(val: string): string | null {
  const trimmed = val.trim()
  return trimmed === '' ? null : trimmed
}

export function PlayerFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { players, isLoading } = usePlayers()
  const queryClient = useQueryClient()

  const existing = id ? players.find(p => p.id === id) : undefined

  // ── Form state (all hooks before any early return) ──────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [nationality, setNationality] = useState('')
  const [secondNationality, setSecondNationality] = useState('')
  const [preferredFoot, setPreferredFoot] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [currentClub, setCurrentClub] = useState('')
  const [league, setLeague] = useState('')
  const [position, setPosition] = useState('')
  const [contractExpiry, setContractExpiry] = useState('')
  const [marketValue, setMarketValue] = useState('')
  const [agentName, setAgentName] = useState('')
  const [agentContact, setAgentContact] = useState('')
  const [transfermarktUrl, setTransfermarktUrl] = useState('')
  const [instagram, setInstagram] = useState('')
  const [youtube, setYoutube] = useState('')
  const [bestFitTeamId, setBestFitTeamId] = useState('')
  const [status, setStatus] = useState<'active' | 'watchlist' | 'archived'>('active')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  // Populate form when editing an existing player (runs when data loads)
  useEffect(() => {
    if (!existing) return
    const social = (existing.social_links ?? {}) as SocialLinks
    setFirstName(existing.first_name)
    setLastName(existing.last_name)
    setDateOfBirth(existing.date_of_birth ?? '')
    setNationality(existing.nationality ?? '')
    setSecondNationality(existing.second_nationality ?? '')
    setPreferredFoot(existing.preferred_foot ?? '')
    setHeightCm(existing.height_cm?.toString() ?? '')
    setCurrentClub(existing.current_club ?? '')
    setLeague(existing.league ?? '')
    setPosition(existing.position ?? '')
    setContractExpiry(existing.contract_expiry ?? '')
    setMarketValue(existing.market_value ?? '')
    setAgentName(existing.agent_name ?? '')
    setAgentContact(existing.agent_contact ?? '')
    setTransfermarktUrl(existing.transfermarkt_url ?? '')
    setInstagram(social.instagram ?? '')
    setYoutube(social.youtube ?? '')
    setBestFitTeamId(existing.best_fit_team_id ?? '')
    setStatus(existing.status)
  }, [existing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early returns (after all hooks) ────────────────────────────────────
  if (isEdit && isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-500">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
        {t('common.loading')}
      </div>
    )
  }
  if (isEdit && !existing) {
    return <Navigate to="/players" replace />
  }

  // ── Validation + submission ─────────────────────────────────────────────
  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!transfermarktUrl.trim()) e.transfermarktUrl = t('playerForm.errors.required')
    else if (!isValidUrl(transfermarktUrl)) e.transfermarktUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(instagram)) e.instagram = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(youtube)) e.youtube = t('playerForm.errors.invalidUrl')
    const bestFitValue = bestFitTeamId.trim() || null
    if (!bestFitSchema.safeParse(bestFitValue).success) e.bestFitTeamId = t('playerForm.errors.invalidTeam')
    return e
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setSubmitting(true)

    try {
      const social_links: SocialLinks = Object.fromEntries(
        Object.entries({ instagram, youtube }).filter(([, v]) => v.trim()),
      ) as SocialLinks

      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        date_of_birth: orNull(dateOfBirth),
        nationality: orNull(nationality),
        second_nationality: orNull(secondNationality),
        preferred_foot: (orNull(preferredFoot) as 'Left' | 'Right' | 'Both' | null),
        height_cm: heightCm.trim() ? Number(heightCm) : null,
        current_club: orNull(currentClub),
        league: orNull(league),
        position: orNull(position),
        contract_expiry: orNull(contractExpiry),
        market_value: orNull(marketValue),
        agent_name: orNull(agentName),
        agent_contact: orNull(agentContact),
        transfermarkt_url: orNull(transfermarktUrl),
        social_links,
        best_fit_team_id: orNull(bestFitTeamId),
        status,
      }

      if (isEdit && id) {
        await updatePlayer(id, payload as PlayerUpdate)
        toast.success(t('toast.playerUpdated'))
      } else {
        await addPlayer(payload as PlayerInsert)
        toast.success(t('toast.playerAdded'))
      }

      await queryClient.invalidateQueries({ queryKey: ['players'] })
      navigate('/players')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('toast.error')
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    void handleSave()
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {/* Page header */}
      <div className="mb-6 grid grid-cols-3 items-center">
        <button
          type="button"
          onClick={() => navigate('/players')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={16} />
          {t('playerForm.back')}
        </button>
        <h1 className="text-center text-xl font-semibold text-gray-900">
          {isEdit ? t('playerForm.editTitle') : t('playerForm.addTitle')}
        </h1>
        <div className="flex justify-end">
          <Button loading={submitting} onClick={() => void handleSave()}>
            {t('playerForm.savePlayer')}
          </Button>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="flex flex-col gap-6">
        {/* ── BASIC INFO ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.basicInfo')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('playerForm.fields.firstName')}
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.lastName')}
              value={lastName}
              onChange={e => setLastName(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.dateOfBirth')}
              type="date"
              value={dateOfBirth}
              onChange={e => setDateOfBirth(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.nationality')}
              value={nationality}
              onChange={e => setNationality(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.secondNationality')}
              value={secondNationality}
              onChange={e => setSecondNationality(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('playerForm.fields.preferredFoot')}
              </label>
              <select
                value={preferredFoot}
                onChange={e => setPreferredFoot(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">—</option>
                {PREFERRED_FOOT_OPTIONS.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <Input
              label={t('playerForm.fields.heightCm')}
              type="number"
              min="100"
              max="230"
              value={heightCm}
              onChange={e => setHeightCm(e.target.value)}
            />
          </div>
        </section>

        {/* ── CLUB & POSITION ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.clubPosition')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('playerForm.fields.currentClub')}
              value={currentClub}
              onChange={e => setCurrentClub(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.league')}
              value={league}
              onChange={e => setLeague(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('playerForm.fields.position')}
              </label>
              <select
                value={position}
                onChange={e => setPosition(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">—</option>
                {POSITIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <Input
              label={t('playerForm.fields.contractExpiry')}
              type="date"
              value={contractExpiry}
              onChange={e => setContractExpiry(e.target.value)}
            />
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.marketValue')}
                placeholder="e.g. €5M"
                value={marketValue}
                onChange={e => setMarketValue(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ── AGENT ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.agent')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('playerForm.fields.agentName')}
              value={agentName}
              onChange={e => setAgentName(e.target.value)}
            />
            <Input
              label={t('playerForm.fields.agentContact')}
              value={agentContact}
              onChange={e => setAgentContact(e.target.value)}
            />
          </div>
        </section>

        {/* ── LINKS & SOCIAL ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.linksSocial')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.transfermarktUrl')}
                required
                type="url"
                placeholder="https://www.transfermarkt.com/..."
                value={transfermarktUrl}
                onChange={e => setTransfermarktUrl(e.target.value)}
                error={errors.transfermarktUrl}
              />
            </div>
            <Input
              label={t('playerForm.fields.instagram')}
              type="url"
              placeholder="https://instagram.com/..."
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              error={errors.instagram}
            />
            <Input
              label={t('playerForm.fields.youtube')}
              type="url"
              placeholder="https://youtube.com/..."
              value={youtube}
              onChange={e => setYoutube(e.target.value)}
              error={errors.youtube}
            />
          </div>
        </section>

        {/* ── INTERNAL SCOUTING ── */}
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">
            {t('playerForm.sections.internal')}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('playerForm.fields.bestFitTeam')}
              </label>
              <select
                value={bestFitTeamId}
                onChange={e => setBestFitTeamId(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">{t('playerForm.fields.noTeam')}</option>
                {ISRAELI_PREMIER_LEAGUE_TEAMS.map(team => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
              {errors.bestFitTeamId && (
                <p className="text-xs text-red-600">{errors.bestFitTeamId}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {t('playerForm.fields.status')}
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'active' | 'watchlist' | 'archived')}
                className={SELECT_CLASS}
              >
                {PLAYER_STATUS_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </section>
      </form>
    </div>
  )
}
