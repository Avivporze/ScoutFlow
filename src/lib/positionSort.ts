import type { SortingFn } from '@tanstack/react-table'
import type { Player } from '@/types/player'

/**
 * Hierarchical position sort weights.
 * Lower weight = closer to top when sorted ascending.
 *
 * 1 = Striker      (ST)
 * 2 = Attackers   (LW, RW, CF)
 * 3 = Midfielders (CDM, CM, CAM, LM, RM)
 * 4 = Defenders   (CB, LB, RB, LWB, RWB)
 * 5 = Goalkeeper  (GK)
 * 6 = Unknown / null (always sinks to bottom)
 */
export const POSITION_WEIGHT: Record<string, number> = {
  // Striker (top of pitch)
  ST: 1,
  // Attackers
  LW: 2, RW: 2, CF: 2,
  // Midfielders
  CDM: 3, CM: 3, CAM: 3, LM: 3, RM: 3,
  // Defenders
  CB: 4, LB: 4, RB: 4, LWB: 4, RWB: 4,
  // Goalkeeper
  GK: 5,
}

export function getPositionWeight(position: string | null): number {
  return position != null ? (POSITION_WEIGHT[position] ?? 6) : 6
}

export const positionSortingFn: SortingFn<Player> = (rowA, rowB) => {
  return getPositionWeight(rowA.original.position) - getPositionWeight(rowB.original.position)
}
