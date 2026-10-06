import { useEffect } from 'react'
import { noteCopy, useT } from '../i18n'
import { AuthScreen } from './AuthScreen'
import { api, isUnreachable } from '../net/api'
import { useLink } from '../net/link'
import { useSession } from '../net/session'
import { clearHeld } from '../office/input'

export function ConnectionPage() {
  const apiDown = useLink((state) => state.api === 'down')
  const replaced = useLink((state) => state.replaced)
  const retrying = useLink((state) => state.retrying)
  const note = useLink((state) => state.note)

  useEffect(() => {
    clearHeld()
    if (document.pointerLockElement) document.exitPointerLock()
    const stop = (event: KeyboardEvent) => {
      event.stopPropagation()
    }
    window.addEventListener('keydown', stop, true)
    window.addEventListener('keyup', stop, true)
    return () => {
      window.removeEventListener('keydown', stop, true)
      window.removeEventListener('keyup', stop, true)
    }
  }, [])

  async function reconnect() {
    if (useLink.getState().retrying) return
    useLink.getState().beginRetry()
    try {
      await api('/health')
      await useSession.getState().load()
    } catch (error) {
      useLink.getState().endRetry(isUnreachable(error) ? 'Still unreachable.' : 'Could not reconnect.')
      return
    }
    if (useSession.getState().user && useLink.getState().world === 'down') {
      useLink.getState().bump()
      return
    }
    useLink.getState().endRetry('')
  }

  const t = useT()
  const title = replaced ? t('signedElsewhere') : apiDown ? t('serverDown') : t('disconnectedTitle')
  const lede = replaced
    ? t('elsewhereLede')
    : apiDown
      ? t('serverLede')
      : t('dropLede')

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-paper text-ink">
      <AuthScreen eyebrow={t('connection')} title={title} lede={lede}>
        <p className="text-sm font-bold text-danger">{t('disconnected')}</p>
        <button
          type="button"
          onClick={() => void reconnect()}
          disabled={retrying}
          className="mt-4 w-full rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lift disabled:opacity-60"
        >
          {retrying ? t('reconnecting') : t('reconnect')}
        </button>
        {note ? <p className="mt-3 text-sm font-medium text-danger">{noteCopy(note, t)}</p> : null}
      </AuthScreen>
    </div>
  )
}
