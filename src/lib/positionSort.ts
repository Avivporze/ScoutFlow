import type { SortingFn } from '@tanstack/react-table'
import type { Player } from '@/types/player'

/**
 * Hierarchical position sort weights.
 * Lower weight = closer to top when sorted ascending.
 *
 * 1 = Attackers   (LW, RW, CF, ST)
 * 2 = Midfielders (CDM, CM, CAM, LM, RM)
 * 3 = Defenders   (CB, LB, RB, LWB, RWB)
 * 4 = Goalkeeper  (GK)
 * 5 = Unknown / null (always sinks to bottom)
 */
export const POSITION_WEIGHT: Record<string, number> = {
  // Attackers
  LW: 1, RW: 1, CF: 1, ST: 1,
  // Midfielders
  CDM: 2, CM: 2, CAM: 2, LM: 2, RM: 2,
  // Defenders
  CB: 3, LB: 3, RB: 3, LWB: 3, RWB: 3,
  // Goalkeeper
  GK: 4,
}

export function getPositionWeight(position: string | null): number {
  return position != null ? (POSITION_WEIGHT[position] ?? 5) : 5
}

export const positionSortingFn: SortingFn<Player> = (rowA, rowB) => {
  return getPositionWeight(rowA.original.position) - getPositionWeight(rowB.original.position)
}
