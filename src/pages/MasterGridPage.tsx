import { useSearchParams } from 'react-router-dom'
import { MasterGrid } from '@/components/table/MasterGrid'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

export function MasterGridPage() {
  useRealtimeSync()
  const [searchParams] = useSearchParams()
  const contractAlertMode = searchParams.get('filter') === 'contract_alert'

  return (
    <PageWrapper>
      <MasterGrid contractAlertMode={contractAlertMode} />
    </PageWrapper>
  )
}
