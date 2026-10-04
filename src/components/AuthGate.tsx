import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useSession } from '../net/session'

function Waiting() {
  return (
    <main className="px-5 py-16 text-ink md:px-8">
      <p className="text-sm text-ink/70">Checking your session…</p>
    </main>
  )
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const ready = useSession((state) => state.ready)
  const user = useSession((state) => state.user)
  if (!ready) return <Waiting />
  if (!user) return children
  return <Navigate to={user.avatarReady ? '/office' : '/avatar'} replace />
}

export function RequireAccount({ children }: { children: ReactNode }) {
  const ready = useSession((state) => state.ready)
  const user = useSession((state) => state.user)
  if (!ready) return <Waiting />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export function RequireOffice({ children }: { children: ReactNode }) {
  const ready = useSession((state) => state.ready)
  const user = useSession((state) => state.user)
  if (!ready) return <Waiting />
  if (!user) return <Navigate to="/login" replace />
  if (!user.avatarReady) return <Navigate to="/avatar" replace />
  return children
}

export function HomeRedirect() {
  const ready = useSession((state) => state.ready)
  const user = useSession((state) => state.user)
  if (!ready) return <Waiting />
  if (!user) return <Navigate to="/login" replace />
  if (!user.avatarReady) return <Navigate to="/avatar" replace />
  return <Navigate to="/office" replace />
}
