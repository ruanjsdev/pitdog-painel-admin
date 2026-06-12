import type { ReactNode } from "react"

function OptionalPanel({ children, open }: { children: ReactNode; open: boolean }) {
  if (!open) return null

  return <>{children}</>
}

export function MenuAdminPanel({ children, open }: { children: ReactNode; open: boolean }) {
  return <OptionalPanel open={open}>{children}</OptionalPanel>
}

export function CashPanel({ children, open }: { children: ReactNode; open: boolean }) {
  return <OptionalPanel open={open}>{children}</OptionalPanel>
}

export function ClientsPanel({ children, open }: { children: ReactNode; open: boolean }) {
  return <OptionalPanel open={open}>{children}</OptionalPanel>
}

export function OrderDetails({ children }: { children: ReactNode }) {
  return (
    <aside className="dashboard-order-details min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-[rgba(18,11,7,0.84)] p-4">
      {children}
    </aside>
  )
}
