import type { ReactNode } from "react"

type Props = {
  children: ReactNode
}

export function MainLayout({ children }: Props) {
  return (
    <div className="login-screen relative min-h-dvh overflow-x-hidden overflow-y-auto text-white lg:h-dvh lg:overflow-hidden">
      <div className="login-noise absolute inset-0" />
      <div className="login-dots absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 min-h-dvh lg:h-full lg:min-h-0">
        {children}
      </div>
    </div>
  )
}
