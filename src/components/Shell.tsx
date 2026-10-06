import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { SKINS, type SkinId } from '../avatar/parts'
import { useLink } from '../net/link'
import { useSession } from '../net/session'
import { useAvatarStore } from '../store/avatar'
import { useT } from '../i18n'
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

  const t = useT()
  const home = !user ? '/login' : user.avatarReady ? '/office' : '/avatar'
  const path = useLocation().pathname
  const office = path === '/office'
  const desk = path === '/desktop'

  return (
    <div className="flex min-h-svh flex-col text-ink">
      {office ? null : <header className={`${desk ? 'hidden sm:flex' : 'flex'} items-center justify-between gap-2 px-4 py-4 sm:px-5 md:px-8`}>
        <NavLink to={home} className="flex shrink-0 items-center gap-2.5 text-ink" aria-label={t('home')}>
          <BrandMark className="h-7 w-auto" />
          <span className="text-xl leading-none font-black">CORP Realm</span>
        </NavLink>
        <nav className="flex min-w-0 items-center overflow-x-auto" aria-label={t('primary')}>
          {ready && !user ? (
            <>
              <NavLink to="/login" className={navClass}>
                {t('signIn')}
              </NavLink>
              <NavLink to="/register" className={navClass}>
                {t('register')}
              </NavLink>
            </>
          ) : null}
          {user ? (
            <NavLink to="/avatar" className={navClass}>
              {t('avatar')}
            </NavLink>
          ) : null}
          {user?.avatarReady ? (
            <>
              <NavLink to="/office" className={navClass}>
                {t('office')}
              </NavLink>
              <NavLink to="/desktop" className={navClass}>
                {t('desktop')}
              </NavLink>
              <NavLink to="/build" className={navClass}>
                {t('builder')}
              </NavLink>
            </>
          ) : null}
          {user ? (
            <button type="button" onClick={() => void logout()} className="rounded-full px-2.5 py-1.5 text-sm font-medium text-ink hover:bg-frost sm:px-3">
              {t('logOut')}
            </button>
          ) : null}
        </nav>
      </header>}
      <div className={office ? 'relative min-h-svh' : desk ? 'relative h-svh sm:h-auto sm:min-h-0 sm:flex-1' : 'relative min-h-0 flex-1'}>
      <Outlet />
      </div>
      {offline ? <ConnectionPage /> : null}
    </div>
  )
}
