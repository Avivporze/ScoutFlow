import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/useAuth'
import { useUpdateProfile } from '@/hooks/useProfiles'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import i18n from '@/i18n/config'

export function ProfileSection() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const updateProfile = useUpdateProfile()

  const [fullName, setFullName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [language, setLanguage] = useState<'en' | 'es'>('en')

  // Sync form state with profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setAvatarUrl(profile.avatar_url || '')
      setLanguage(profile.preferred_language || 'en')
    }
  }, [profile])

  const isDirty =
    fullName !== (profile?.full_name || '') ||
    avatarUrl !== (profile?.avatar_url || '') ||
    language !== (profile?.preferred_language || 'en')

  function handleSave() {
    if (!user) return
    updateProfile.mutate(
      {
        id: user.id,
        updates: {
          full_name: fullName.trim(),
          avatar_url: avatarUrl.trim() || null,
          preferred_language: language,
        },
      },
      {
        onSuccess: () => {
          void i18n.changeLanguage(language)
          toast.success(t('settings.profile.saved'))
        },
        onError: () => {
          toast.error(t('toast.error'))
        },
      },
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        {t('settings.profile.title')}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {t('settings.profile.description')}
      </p>

      <div className="mt-6 max-w-md space-y-5">
        {/* Full Name */}
        <Input
          label={t('settings.profile.fullName')}
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          required
        />

        {/* Email (read-only) */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            {t('settings.profile.email')}
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
          />
          <p className="text-xs text-gray-400">{t('settings.profile.emailHint')}</p>
        </div>

        {/* Avatar URL */}
        <div className="flex flex-col gap-1">
          <Input
            label={t('settings.profile.avatarUrl')}
            type="url"
            value={avatarUrl}
            onChange={e => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-gray-400">{t('settings.profile.avatarUrlHint')}</p>
        </div>

        {/* Preview avatar */}
        {avatarUrl.trim() && (
          <div className="flex items-center gap-3">
            <img
              src={avatarUrl.trim()}
              alt="Avatar preview"
              className="h-10 w-10 rounded-full border border-gray-200 object-cover"
              onError={e => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
            <span className="text-xs text-gray-400">Preview</span>
          </div>
        )}

        {/* Preferred Language */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">
            {t('settings.profile.language')}
          </label>
          <div className="flex rounded-lg border border-gray-200 p-1 max-w-xs">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                language === 'en'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('settings.profile.english')}
            </button>
            <button
              type="button"
              onClick={() => setLanguage('es')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                language === 'es'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t('settings.profile.spanish')}
            </button>
          </div>
        </div>

        {/* Save */}
        <div className="pt-2">
          <Button
            onClick={handleSave}
            disabled={!isDirty || !fullName.trim()}
            loading={updateProfile.isPending}
          >
            {t('settings.profile.saveChanges')}
          </Button>
        </div>
      </div>
    </div>
  )
}
