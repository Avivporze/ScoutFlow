import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Users,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onCloseMobile?: () => void
}

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', end: true },
  { to: '/players', icon: Search, labelKey: 'nav.players', end: false },
  { to: '/filter', icon: Users, labelKey: 'nav.shortlists', end: false },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings', end: false },
] as const

export function Sidebar({ collapsed, onToggle, onCloseMobile }: SidebarProps) {
  const { t, i18n } = useTranslation()
  const { user, profile } = useAuth()

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-[width] duration-200',
        collapsed ? 'w-20' : 'w-64',
      )}
    >
      {/* Brand */}
      <div className={cn("flex shrink-0 items-center justify-between border-b border-gray-100 p-6 pt-7 pb-5", collapsed && "justify-center")}>
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
            <Shield size={16} />
          </div>
          {!collapsed && <span className="text-[17px] font-bold text-gray-900 tracking-tight">ScoutDesk</span>}
        </div>
      </div>

      {/* Workspace Section */}
      <div className={cn("border-b border-gray-100 px-6 py-5", collapsed && "hidden")}>
         <div className="mb-2 text-[10px] sm:text-[11px] font-bold tracking-[0.05em] text-gray-400">
            WORKSPACE
         </div>
         <div className="mb-1.5 text-sm font-bold text-gray-900 sm:text-[15px]">
            Aviv's Workspace
         </div>
         <span className="inline-flex items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-blue-600">
            Admin
         </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 pt-6">
        <div className="flex flex-col gap-1">
          {navItems.map(({ to, icon: Icon, labelKey, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => onCloseMobile?.()}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#f0f5ff] text-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  collapsed && 'justify-center px-0'
                )
              }
              title={collapsed ? t(labelKey) : undefined}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2 : 1.75}
                    className={cn(
                      'shrink-0',
                      isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600',
                    )}
                  />
                  {!collapsed && <span className="mt-[1px]">{t(labelKey)}</span>}
                  {isActive && !collapsed && (
                    <span className="absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-blue-600" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Bottom Layout - Language & Profile */}
      <div className="mt-auto flex flex-col px-6 pb-6">
         {/* Divider Line */}
         <div className={cn("mb-6 h-[1px] w-full bg-gray-100", collapsed && "hidden")} />

         {/* Language Section */}
         <div className={cn("mb-6", collapsed && "hidden")}>
            <div className="mb-3 text-[10px] sm:text-[11px] font-bold tracking-[0.05em] text-gray-400">
               LANGUAGE
            </div>
            <div className="flex rounded-lg bg-gray-50/70 p-1">
               <button 
                 onClick={() => void i18n.changeLanguage('en')}
                 className={cn("flex-1 rounded-md py-1.5 text-xs font-semibold transition-all", i18n.language === 'en' ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
               >
                  EN
               </button>
               <button 
                 onClick={() => void i18n.changeLanguage('es')}
                 className={cn("flex-1 rounded-md py-1.5 text-xs font-semibold transition-all", i18n.language === 'es' || i18n.language?.startsWith('es') ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}
               >
                  ES
               </button>
            </div>
         </div>

         {/* User Section */}
         <div className={cn("flex flex-col gap-3.5", collapsed && "items-center")}>
            {!collapsed && (
              <div className="mb-1">
                 <div className="text-sm font-bold text-gray-900">{profile?.full_name || 'אביב פורזקנסקי'}</div>
                 <div className="text-[12px] sm:text-xs font-medium text-gray-400">{user?.email || 'porze.aviv@gmail.com'}</div>
              </div>
            )}

            <button
               onClick={onToggle}
               className={cn("flex items-center gap-3 text-[13px] sm:text-sm font-medium text-gray-500 transition-colors hover:text-gray-900", collapsed && "justify-center")}
               title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            >
               {collapsed ? <ChevronRight size={16} className="shrink-0" /> : <ChevronLeft size={16} className="shrink-0" />}
               {!collapsed && <span>{t('sidebar.collapse')}</span>}
            </button>
         </div>
      </div>
    </aside>
  )
}
