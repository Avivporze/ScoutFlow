import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import { getPlayers } from '@/api/players'
import { Button } from '@/components/ui/Button'
import type { Player } from '@/types/player'

function playerToCsvRow(p: Player): string {
  const fields = [
    p.first_name,
    p.last_name,
    p.date_of_birth || '',
    p.nationality || '',
    p.second_nationality || '',
    p.preferred_foot || '',
    String(p.height_cm ?? ''),
    String(p.weight_kg ?? ''),
    p.current_club || '',
    p.league || '',
    p.position || '',
    p.contract_expiry || '',
    p.market_value || '',
    p.agent_name || '',
    p.agent_contact || '',
    p.transfermarkt_url || '',
    p.fbref_url || '',
    String(p.stats_matches),
    String(p.stats_goals),
    String(p.stats_assists),
    String(p.stats_minutes),
    p.stats_updated_at || '',
    p.status,
    p.created_at,
    p.updated_at,
  ]
  // Escape quotes and wrap fields containing commas/quotes/newlines
  return fields
    .map(f => {
      const s = String(f)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    })
    .join(',')
}

const CSV_HEADERS = [
  'First Name',
  'Last Name',
  'Date of Birth',
  'Nationality',
  'Second Nationality',
  'Preferred Foot',
  'Height (cm)',
  'Weight (kg)',
  'Current Club',
  'League',
  'Position',
  'Contract Expiry',
  'Market Value',
  'Agent Name',
  'Agent Contact',
  'Transfermarkt URL',
  'FBref URL',
  'Matches',
  'Goals',
  'Assists',
  'Minutes',
  'Stats Updated At',
  'Status',
  'Created At',
  'Updated At',
].join(',')

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function DataExportSection() {
  const { t } = useTranslation()
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)

  async function handleExport(format: 'csv' | 'json') {
    setExporting(format)
    try {
      const players = await getPlayers()

      if (players.length === 0) {
        toast.error(t('settings.export.noData'))
        return
      }

      const timestamp = new Date().toISOString().split('T')[0]

      if (format === 'csv') {
        const rows = players.map(playerToCsvRow)
        const csv = [CSV_HEADERS, ...rows].join('\n')
        downloadFile(csv, `scoutflow-players-${timestamp}.csv`, 'text/csv')
      } else {
        const json = JSON.stringify(players, null, 2)
        downloadFile(json, `scoutflow-players-${timestamp}.json`, 'application/json')
      }

      toast.success(t('settings.export.success'))
    } catch {
      toast.error(t('toast.error'))
    } finally {
      setExporting(null)
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">
        {t('settings.export.title')}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {t('settings.export.description')}
      </p>

      <div className="mt-6 flex gap-3">
        <Button
          variant="secondary"
          onClick={() => void handleExport('csv')}
          loading={exporting === 'csv'}
          disabled={exporting !== null}
        >
          <Download size={16} />
          {t('settings.export.exportCsv')}
        </Button>
        <Button
          variant="secondary"
          onClick={() => void handleExport('json')}
          loading={exporting === 'json'}
          disabled={exporting !== null}
        >
          <Download size={16} />
          {t('settings.export.exportJson')}
        </Button>
      </div>
    </div>
  )
}
