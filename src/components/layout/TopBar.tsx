import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

const pathTitleKey: Record<string, string> = {
  '/': 'pages.dashboard',
  '/players': 'pages.players',
  '/filter': 'pages.filter',
  '/settings': 'pages.settings',
}

export function TopBar() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()

  const titleKey = pathTitleKey[pathname] ?? 'pages.dashboard'

  async function handleSignOut() {
    await signOut()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-gray-900">{t(titleKey)}</h1>

      <div className="flex items-center gap-4">
        {profile && (
          <span className="text-sm text-gray-600">{profile.full_name}</span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handleSignOut()}
          className="gap-1.5 text-gray-500"
          title={t('auth.signOut')}
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">{t('auth.signOut')}</span>
        </Button>
      </div>
    </header>
  )
}
