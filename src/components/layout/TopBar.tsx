import { useTranslation } from 'react-i18next'
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

interface TopBarProps {
  onMenuClick?: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()

  async function handleSignOut() {
    await signOut()
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="sm:hidden -ml-2 p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
        >
          <Menu size={20} />
        </button>
      </div>

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
