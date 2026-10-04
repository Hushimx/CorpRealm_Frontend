import { useEffect, useState } from 'react'
import { SKINS, skinCropStyle, type SkinId } from '../avatar/parts'
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

function weekLabel(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  if (!year || !month || !day) return 'This week'
  const start = new Date(year, month - 1, day)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const format = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
  return `${format.format(start)} – ${format.format(end)}`
}

function hoursLabel(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export function StatsDesk({ officeId, onClose }: { officeId: string; onClose: () => void }) {
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
          if (!closed) setError('The weekly stats could not be loaded.')
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
    <section className="absolute top-16 right-3 bottom-4 left-28 z-10 flex flex-col overflow-hidden rounded-card bg-paper text-ink shadow-card sm:right-4 sm:left-32">
      <div className="flex items-start justify-between gap-3 border-b border-ink/10 px-4 py-3">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Stats</p>
          <h2 className="font-bold text-3xl leading-none">This week</h2>
          <p className="mt-1 text-xs text-ink/60">Sunday through Saturday{stats ? ` · ${weekLabel(stats.weekStart)}` : ''}. Hours in the office, and tasks moved to Done.</p>
        </div>
        <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {error ? <p className="rounded-card border border-line bg-mist px-4 py-4 text-sm font-medium text-danger">{error}</p> : null}
        {!stats && !error ? <p className="rounded-card border border-line bg-mist px-4 py-6 text-sm text-ink">Loading the week…</p> : null}
        {stats && stats.people.length === 0 ? <p className="rounded-card border border-line bg-mist px-4 py-6 text-sm text-ink">No one belongs to this office yet.</p> : null}
        {stats?.people.map((person) => (
          <article key={person.id} className="flex items-center gap-3 rounded-card border border-line bg-mist px-3 py-2.5 text-ink">
            <span className="block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-paper" style={skinCropStyle('head', knownFace(person.face))} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink">{person.name.trim() || 'Unnamed'}</p>
              <p className="text-xs text-ink/65">{person.tasksDone === 1 ? '1 task done' : `${person.tasksDone} tasks done`}</p>
            </div>
            <p className="shrink-0 font-bold text-2xl leading-none text-lift tabular-nums">{hoursLabel(person.seconds)}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
