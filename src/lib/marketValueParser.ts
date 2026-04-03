/**
 * Parses a Transfermarkt market value string into a numeric euro value.
 *
 * Handles:
 *   "€5.00m"  → 5_000_000
 *   "€500k"   → 500_000
 *   "€1.5m"   → 1_500_000
 *   "-"       → 0
 *   null/undefined/empty → 0
 */
export function parseMarketValue(raw: string | null | undefined): number {
  if (!raw) return 0
  const trimmed = raw.trim()
  if (trimmed === '' || trimmed === '-') return 0

  // Strip currency symbols (€, $, £, ¥) and normalize to lowercase
  const normalized = trimmed.replace(/[€$£¥]/g, '').trim().toLowerCase()

  const millionsMatch = normalized.match(/^([\d.]+)m$/)
  if (millionsMatch) {
    const value = parseFloat(millionsMatch[1])
    return isNaN(value) ? 0 : Math.round(value * 1_000_000)
  }

  const thousandsMatch = normalized.match(/^([\d.]+)k$/)
  if (thousandsMatch) {
    const value = parseFloat(thousandsMatch[1])
    return isNaN(value) ? 0 : Math.round(value * 1_000)
  }

  const plain = parseFloat(normalized)
  return isNaN(plain) ? 0 : Math.round(plain)
}
