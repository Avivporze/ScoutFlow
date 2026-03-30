import type { ReactNode } from 'react'

interface PageWrapperProps {
  children: ReactNode
}

export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <main className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-[1400px]">{children}</div>
    </main>
  )
}
