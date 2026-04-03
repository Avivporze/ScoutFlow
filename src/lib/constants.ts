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

export const ISRAELI_PREMIER_LEAGUE_TEAMS = [
  'Maccabi Tel Aviv',
  'Maccabi Haifa',
  "Hapoel Be'er Sheva",
  'Beitar Jerusalem',
  'Hapoel Haifa',
  'Hapoel Tel Aviv',
  'Maccabi Netanya',
  'Maccabi Bnei Reineh',
  'Hapoel Jerusalem',
  'F.C. Ashdod',
  'Hapoel Hadera',
  'Ironi Tiberias',
  'Ironi Kiryat Shmona',
  'Maccabi Petah Tikva',
] as const
