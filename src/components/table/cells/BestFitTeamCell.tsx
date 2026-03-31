interface Props {
  teamId: string | null
  teamsMap: Map<string, string>
}

export function BestFitTeamCell({ teamId, teamsMap }: Props) {
  if (!teamId) return <span className="text-gray-400">—</span>
  const name = teamsMap.get(teamId)
  return <span className="text-gray-700">{name ?? '—'}</span>
}
