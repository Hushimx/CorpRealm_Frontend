import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { SKINS, type SkinId } from '../avatar/parts'
import { useLink } from '../net/link'
import { useSession } from '../net/session'
import { useAvatarStore } from '../store/avatar'
import { BrandMark } from './BrandMark'
import { ConnectionPage } from './ConnectionPage'

function navClass({ isActive }: { isActive: boolean }) {
  return [
    'rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors sm:px-3',
    isActive ? 'bg-ink text-paper' : 'text-ink hover:bg-frost',
  ].join(' ')
}

export function Shell() {
  const load = useSession((state) => state.load)
  const ready = useSession((state) => state.ready)
  const user = useSession((state) => state.user)
  const logout = useSession((state) => state.logout)
  const setName = useAvatarStore((state) => state.setName)
  const setFace = useAvatarStore((state) => state.setFace)
  const setOutfit = useAvatarStore((state) => state.setOutfit)
  const setPants = useAvatarStore((state) => state.setPants)
  const offline = useLink((state) => state.api === 'down' || state.world === 'down')
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    if (!navigator.onLine) useLink.getState().markApiDown()
    const down = () => useLink.getState().markApiDown()
    const probe = () => {
      if (useLink.getState().api === 'down' || useLink.getState().retrying) return
      void fetch('/api/health', { credentials: 'include' })
        .then((response) => {
          if (response.status === 502 || response.status === 503 || response.status === 504) useLink.getState().markApiDown()
        })
        .catch(() => useLink.getState().markApiDown())
    }
    const timer = window.setInterval(probe, 4000)
    window.addEventListener('offline', down)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('offline', down)
    }
  }, [])
  useEffect(() => {
    if (!user) return
    setName(user.name)
    if ((SKINS as readonly string[]).includes(user.face)) setFace(user.face as SkinId)
    if ((SKINS as readonly string[]).includes(user.outfit)) setOutfit(user.outfit as SkinId)
    if ((SKINS as readonly string[]).includes(user.pants)) setPants(user.pants as SkinId)
  }, [setFace, setName, setOutfit, setPants, user?.id])

  const home = !user ? '/login' : user.avatarReady ? '/office' : '/avatar'
  const office = useLocation().pathname === '/office'

  return (
    <div className="min-h-svh text-ink">
      {office ? null : <header className="flex items-center justify-between gap-2 px-4 py-4 sm:px-5 md:px-8">
        <NavLink to={home} className="flex shrink-0 items-center gap-2.5 text-ink" aria-label="CORP Realm home">
          <BrandMark className="h-7 w-auto" />
          <span className="text-xl leading-none font-black">CORP Realm</span>
        </NavLink>
        <nav className="flex min-w-0 items-center overflow-x-auto" aria-label="Primary">
          {ready && !user ? (
            <>
              <NavLink to="/login" className={navClass}>
                Sign in
              </NavLink>
              <NavLink to="/register" className={navClass}>
                Register
              </NavLink>
            </>
          ) : null}
          {user ? (
            <NavLink to="/avatar" className={navClass}>
              Avatar
            </NavLink>
          ) : null}
          {user?.avatarReady ? (
            <>
              <NavLink to="/office" className={navClass}>
                Office
              </NavLink>
              <NavLink to="/build" className={navClass}>
                Builder
              </NavLink>
            </>
          ) : null}
          {user ? (
            <button type="button" onClick={() => void logout()} className="rounded-full px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-frost sm:px-3">
              Log out
            </button>
          ) : null}
        </nav>
      </header>}
      <Outlet />
      {offline ? <ConnectionPage /> : null}
    </div>
  )
}
