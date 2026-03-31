import { MasterGrid } from '@/components/table/MasterGrid'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'

export function MasterGridPage() {
  useRealtimeSync()
  return (
    <PageWrapper>
      <MasterGrid />
    </PageWrapper>
  )
}
