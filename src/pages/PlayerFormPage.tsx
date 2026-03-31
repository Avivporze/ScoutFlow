import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ChevronLeft } from 'lucide-react'
import { usePlayers } from '@/hooks/usePlayers'
import { useTeams } from '@/hooks/useTeams'
import { addPlayer, updatePlayer } from '@/api/players'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { POSITIONS, PREFERRED_FOOT_OPTIONS, PLAYER_STATUS_OPTIONS } from '@/lib/constants'
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

export function PlayerFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { players, isLoading } = usePlayers()
  const { teams } = useTeams()

  const existing = id ? players.find(p => p.id === id) : undefined

  // ── Form state (all hooks before any early return) ──────────────────────
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [nationality, setNationality] = useState('')
  const [secondNationality, setSecondNationality] = useState('')
  const [preferredFoot, setPreferredFoot] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [currentClub, setCurrentClub] = useState('')
  const [league, setLeague] = useState('')
  const [position, setPosition] = useState('')
  const [contractExpiry, setContractExpiry] = useState('')
  const [marketValue, setMarketValue] = useState('')
  const [agentName, setAgentName] = useState('')
  const [agentContact, setAgentContact] = useState('')
  const [fbrefUrl, setFbrefUrl] = useState('')
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
    setWeightKg(existing.weight_kg?.toString() ?? '')
    setCurrentClub(existing.current_club ?? '')
    setLeague(existing.league ?? '')
    setPosition(existing.position ?? '')
    setContractExpiry(existing.contract_expiry ?? '')
    setMarketValue(existing.market_value ?? '')
    setAgentName(existing.agent_name ?? '')
    setAgentContact(existing.agent_contact ?? '')
    setFbrefUrl(existing.fbref_url ?? '')
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
        Loading…
      </div>
    )
  }
  if (isEdit && !existing) {
    return <Navigate to="/players" replace />
  }

  // ── Validation + submission ─────────────────────────────────────────────
  function validate(): FormErrors {
    const e: FormErrors = {}
    if (!firstName.trim()) e.firstName = t('playerForm.errors.required')
    if (!lastName.trim()) e.lastName = t('playerForm.errors.required')
    if (!isValidUrl(fbrefUrl)) e.fbrefUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(transfermarktUrl)) e.transfermarktUrl = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(instagram)) e.instagram = t('playerForm.errors.invalidUrl')
    if (!isValidUrl(youtube)) e.youtube = t('playerForm.errors.invalidUrl')
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

    const social_links: SocialLinks = Object.fromEntries(
      Object.entries({ instagram, youtube }).filter(([, v]) => v.trim()),
    ) as SocialLinks

    const payload = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth || null,
      nationality: nationality.trim() || null,
      second_nationality: secondNationality.trim() || null,
      preferred_foot: (preferredFoot as 'Left' | 'Right' | 'Both') || null,
      height_cm: heightCm ? Number(heightCm) : null,
      weight_kg: weightKg ? Number(weightKg) : null,
      current_club: currentClub.trim() || null,
      league: league.trim() || null,
      position: position.trim() || null,
      contract_expiry: contractExpiry || null,
      market_value: marketValue.trim() || null,
      agent_name: agentName.trim() || null,
      agent_contact: agentContact.trim() || null,
      fbref_url: fbrefUrl.trim() || null,
      transfermarkt_url: transfermarktUrl.trim() || null,
      social_links,
      best_fit_team_id: bestFitTeamId || null,
      status,
    }

    try {
      if (isEdit && id) {
        await updatePlayer(id, payload as PlayerUpdate)
        toast.success(t('toast.playerUpdated'))
      } else {
        await addPlayer(payload as PlayerInsert)
        toast.success(t('toast.playerAdded'))
      }
      navigate('/players')
    } catch {
      toast.error(t('toast.error'))
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
              required
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              error={errors.firstName}
            />
            <Input
              label={t('playerForm.fields.lastName')}
              required
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              error={errors.lastName}
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
            <Input
              label={t('playerForm.fields.weightKg')}
              type="number"
              min="40"
              max="150"
              value={weightKg}
              onChange={e => setWeightKg(e.target.value)}
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
                label={t('playerForm.fields.fbrefUrl')}
                type="url"
                placeholder="https://fbref.com/en/players/..."
                value={fbrefUrl}
                onChange={e => setFbrefUrl(e.target.value)}
                error={errors.fbrefUrl}
              />
            </div>
            <div className="col-span-2">
              <Input
                label={t('playerForm.fields.transfermarktUrl')}
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
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.team_name}</option>
                ))}
              </select>
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
