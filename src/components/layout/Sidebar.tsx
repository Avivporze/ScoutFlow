import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Users,
  Filter,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const navItems = [
  { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard', end: true },
  { to: '/players', icon: Users, labelKey: 'nav.players', end: false },
  { to: '/filter', icon: Filter, labelKey: 'nav.filter', end: false },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings', end: false },
] as const

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { t } = useTranslation()

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-gray-200 bg-white transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Brand + toggle */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-gray-200 px-4',
          collapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!collapsed && (
          <span className="text-lg font-semibold text-gray-900">Scout</span>
        )}
        <button
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto py-3">
        {navItems.map(({ to, icon: Icon, labelKey, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )
            }
            title={collapsed ? t(labelKey) : undefined}
          >
            <Icon size={20} className="shrink-0" />
            {!collapsed && <span>{t(labelKey)}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
