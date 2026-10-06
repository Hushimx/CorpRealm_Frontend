import { useEffect, useState } from 'react'
import { SKINS, skinCropStyle, type SkinId } from '../avatar/parts'
import { useLocale, useT } from '../i18n'
import { api } from '../net/api'

type StatPerson = {
  id: string
  name: string
  face: string
  seconds: number
  tasksDone: number
}

type WeekStats = {
  weekStart: string
  people: StatPerson[]
}

function knownFace(value: string | undefined): SkinId {
  return value && (SKINS as readonly string[]).includes(value) ? (value as SkinId) : 'a'
}

function weekLabel(key: string, locale: string, fallback: string) {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return fallback
  const start = new Date(year, month - 1, day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const format = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  return `${format.format(start)} – ${format.format(end)}`
}

function hoursLabel(seconds: number, hoursText: (hours: number, minutes: number) => string, minutesText: (minutes: number) => string) {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours === 0) return minutesText(minutes)
  return hoursText(hours, minutes)
}

export function StatsDesk({ officeId, onClose }: { officeId: string; onClose: () => void }) {
  const t = useT()
  const locale = useLocale()
  const [stats, setStats] = useState<WeekStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let closed = false
    const load = () => {
      void api<WeekStats>(`/offices/${officeId}/stats`)
        .then((next) => {
          if (closed) return
          setStats(next)
          setError('')
        })
        .catch(() => {
          if (!closed) setError(t('statsFail'))
        })
    }
    load()
    const timer = window.setInterval(load, 5000)
    return () => {
      closed = true
      window.clearInterval(timer)
    }
  }, [officeId])

  return (
    <section className="absolute top-16 end-3 bottom-4 start-32 z-10 flex flex-col overflow-hidden rounded-card bg-paper text-ink shadow-card sm:end-4 sm:start-36">
      <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{t('stats')}</p>
          <h2 className="font-bold text-3xl leading-none">{t('thisWeek')}</h2>
          <p className="mt-1 text-xs text-ink/60">{t('weekRange')}{stats ? ` · ${weekLabel(stats.weekStart, locale, t('thisWeekFallback'))}` : ''}. {t('weekHint')}</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
          {t('close')}
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {error ? <p className="rounded-card border border-line bg-mist px-4 py-4 text-sm font-medium text-danger">{error}</p> : null}
        {!stats && !error ? <p className="rounded-card border border-line bg-mist px-4 py-6 text-sm text-ink">{t('loadingWeek')}</p> : null}
        {stats && stats.people.length === 0 ? <p className="rounded-card border border-line bg-mist px-4 py-6 text-sm text-ink">{t('noOneBelongs')}</p> : null}
        {stats?.people.map((person) => (
          <article key={person.id} className="flex items-center gap-3 rounded-card border border-line bg-mist px-3 py-2.5 text-ink">
            <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-paper" style={skinCropStyle('head', knownFace(person.face))} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{person.name.trim() || t('unnamed')}</p>
              <p className="text-xs text-ink/65">{person.tasksDone === 1 ? t('oneTaskDone') : t('nTasksDone', { n: person.tasksDone })}</p>
            </div>
            <p className="shrink-0 font-bold text-2xl leading-none text-lift tabular-nums">{hoursLabel(person.seconds, (hours, minutes) => t('hoursShort', { h: hours, m: minutes }), (minutes) => t('minutesShort', { m: minutes }))}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
