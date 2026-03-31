import { Instagram, Youtube } from 'lucide-react'
import type { SocialLinks } from '@/types/player'

interface Props {
  links: SocialLinks
}

const PLATFORMS = [
  { key: 'instagram' as const, Icon: Instagram, label: 'Instagram' },
  { key: 'youtube' as const, Icon: Youtube, label: 'YouTube' },
]

export function SocialLinksDisplay({ links }: Props) {
  const active = PLATFORMS.filter(({ key }) => links[key])
  if (active.length === 0) return null

  return (
    <div className="flex items-center gap-3">
      {active.map(({ key, Icon, label }) => (
        <a
          key={key}
          href={links[key]}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="text-gray-500 transition-colors hover:text-blue-600"
        >
          <Icon size={20} />
        </a>
      ))}
    </div>
  )
}
