import { useSession } from '../net/session'

export function AccountCard() {
  const user = useSession((state) => state.user)
  const ready = useSession((state) => state.ready)
  const logout = useSession((state) => state.logout)

  if (!ready || !user) return null

  return (
    <p className="mt-3 text-xs text-ink/70">
      Signed in as <span className="font-medium text-ink">{user.name.trim() || user.email}</span>
      <button type="button" onClick={() => void logout()} className="ml-2 font-medium text-lift underline decoration-lift/40 underline-offset-2">
        Log out
      </button>
    </p>
  )
}
