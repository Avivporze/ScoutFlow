import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Shield, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useProfiles, useUpdateRole } from '@/hooks/useProfiles'

export function UserManagementSection() {
  const { t } = useTranslation()
  const { user, profile } = useAuth()
  const { profiles, isLoading } = useProfiles()
  const updateRole = useUpdateRole()

  const isAdmin = profile?.role === 'admin'

  if (!isAdmin) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {t('settings.users.title')}
        </h2>
        <p className="mt-3 text-sm text-gray-500">
          {t('settings.users.adminOnly')}
        </p>
      </div>
    )
  }

  function handleRoleChange(targetId: string, newRole: 'admin' | 'scout') {
    if (targetId === user?.id) {
      toast.error(t('settings.users.cannotChangeSelf'))
      return
    }
    updateRole.mutate(
      { id: targetId, role: newRole },
      {
        onSuccess: () => toast.success(t('settings.users.roleChanged')),
        onError: () => toast.error(t('toast.error')),
      },
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        {t('settings.users.title')}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {t('settings.users.description')}
      </p>

      <div className="mt-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
            {t('common.loading')}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                    {t('settings.users.name')}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                    {t('settings.users.email')}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                    {t('settings.users.role')}
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">
                    {t('settings.users.joined')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {profiles.map(p => {
                  const isSelf = p.id === user?.id
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {/* Avatar placeholder */}
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                            {p.full_name
                              .split(' ')
                              .map(n => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <span className="font-medium text-gray-900">
                            {p.full_name}
                            {isSelf && (
                              <span className="ml-1.5 text-xs text-gray-400">(you)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{p.email}</td>
                      <td className="px-4 py-2.5">
                        {isSelf ? (
                          // Show badge for self (non-editable)
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              p.role === 'admin'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {p.role === 'admin' ? (
                              <Shield size={12} />
                            ) : (
                              <Users size={12} />
                            )}
                            {p.role === 'admin'
                              ? t('settings.users.admin')
                              : t('settings.users.scout')}
                          </span>
                        ) : (
                          // Dropdown for others
                          <select
                            value={p.role}
                            onChange={e =>
                              handleRoleChange(
                                p.id,
                                e.target.value as 'admin' | 'scout',
                              )
                            }
                            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                          >
                            <option value="admin">
                              {t('settings.users.admin')}
                            </option>
                            <option value="scout">
                              {t('settings.users.scout')}
                            </option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500">
                        {format(new Date(p.created_at), 'MMM d, yyyy')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
