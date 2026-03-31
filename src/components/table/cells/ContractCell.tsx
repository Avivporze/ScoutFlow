import { AlertTriangle } from 'lucide-react'

interface Props {
  contractExpiry: string | null
}

function isExpiringSoon(dateStr: string): boolean {
  const expiry = new Date(dateStr)
  const now = new Date()
  const sixMonthsOut = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate())
  return expiry <= sixMonthsOut
}

export function ContractCell({ contractExpiry }: Props) {
  if (!contractExpiry) return <span className="text-gray-400">—</span>

  const formatted = new Date(contractExpiry).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
  })

  if (isExpiringSoon(contractExpiry)) {
    return (
      <span className="flex items-center gap-1 font-medium text-red-600">
        <AlertTriangle size={12} />
        {formatted}
      </span>
    )
  }

  return <span className="text-gray-700">{formatted}</span>
}
