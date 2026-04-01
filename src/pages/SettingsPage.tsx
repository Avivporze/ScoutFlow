import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Building2, Users, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { ProfileSection } from '@/components/settings/ProfileSection'
import { TeamManagementSection } from '@/components/settings/TeamManagementSection'
import { UserManagementSection } from '@/components/settings/UserManagementSection'
import { DataExportSection } from '@/components/settings/DataExportSection'

type SettingsTab = 'profile' | 'teams' | 'users' | 'export'

interface TabDef {
  key: SettingsTab
  labelKey: string
  icon: typeof User
  adminOnly?: boolean
}

const tabs: TabDef[] = [
  { key: 'profile', labelKey: 'settings.tabs.profile', icon: User },
  { key: 'teams', labelKey: 'settings.tabs.teams', icon: Building2, adminOnly: true },
  { key: 'users', labelKey: 'settings.tabs.users', icon: Users, adminOnly: true },
  { key: 'export', labelKey: 'settings.tabs.export', icon: Download },
]

export function SettingsPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')
  const isAdmin = profile?.role === 'admin'

  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin)

  return (
    <div className="mx-auto max-w-5xl">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t('settings.title')}
        </h1>
      </div>

      <div className="flex gap-8">
        {/* Sidebar Tabs */}
        <nav className="w-52 shrink-0">
          <div className="sticky top-6 flex flex-col gap-1">
            {visibleTabs.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={isActive ? 2 : 1.75}
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-blue-600' : 'text-gray-400',
                    )}
                  />
                  {t(tab.labelKey)}
                </button>
              )
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          {activeTab === 'profile' && <ProfileSection />}
          {activeTab === 'teams' && <TeamManagementSection />}
          {activeTab === 'users' && <UserManagementSection />}
          {activeTab === 'export' && <DataExportSection />}
        </div>
      </div>
    </div>
  )
}
