export const POSITIONS = [
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB',
  'CDM', 'CM', 'CAM', 'LM', 'RM',
  'LW', 'RW', 'CF', 'ST',
] as const

export const PREFERRED_FOOT_OPTIONS = ['Left', 'Right', 'Both'] as const

export const PLAYER_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'archived', label: 'Archived' },
] as const
