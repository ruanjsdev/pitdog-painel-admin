import type { ReactNode } from "react"

type Props = {
  children: ReactNode
}

export function MainLayout({ children }: Props) {
  return (
    <div className="login-screen relative h-dvh min-h-dvh overflow-hidden text-white">
      <div className="login-noise absolute inset-0" />
      <div className="login-dots absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 h-full min-h-0">
        {children}
      </div>
    </div>
  )
}
