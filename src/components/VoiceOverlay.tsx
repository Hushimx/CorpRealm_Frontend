import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SKINS, skinCropStyle, type SkinId } from '../avatar/parts'
import { useT } from '../i18n'
import { VOICE_REACH, type OfficeMedia, type VoicePerson } from '../net/media'

const icon = 'h-5 w-5'

function MicMark({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z" />
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M6.5 11a5.5 5.5 0 0 0 11 0M12 16.5V20" />
      {off ? <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M5 5l14 14" /> : null}
    </svg>
  )
}

function HeadMark({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M4 13v2a2 2 0 0 0 2 2h1v-6H6a2 2 0 0 0-2 2Zm16 0v2a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" />
      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M4 13a8 8 0 0 1 16 0" />
      {off ? <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M5 5l14 14" /> : null}
    </svg>
  )
}

function Dots() {
  return (
    <svg viewBox="0 0 24 24" className={icon} aria-hidden="true">
      <circle cx="12" cy="5" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="19" r="1.6" fill="currentColor" />
    </svg>
  )
}

function knownFace(value: string | undefined): SkinId {
  return value && (SKINS as readonly string[]).includes(value) ? (value as SkinId) : 'a'
}

export function VoiceRoster({ media, faces }: { media: OfficeMedia; faces: Record<string, string> }) {
  const nearby = media.voices.filter((person) => person.near)
  if (!media.ready || nearby.length === 0) return null
  return (
    <ul className="pointer-events-none flex flex-col items-end gap-1.5">
      {nearby.map((person) => (
        <li key={person.id} className={`flex items-center gap-2 rounded-full bg-paper py-1 pr-3 pl-1 text-ink shadow-pop ${person.speaking ? 'ring-2 ring-lift' : ''}`}>
          <span className="block h-8 w-8 overflow-hidden rounded-full bg-frost" style={skinCropStyle('head', knownFace(faces[person.id]))} />
          <span className="max-w-32 truncate text-sm font-medium text-ink">{person.self ? `${person.name} (you)` : person.name}</span>
          {person.muted ? <span className="text-fog"><MicMark off /></span> : null}
        </li>
      ))}
    </ul>
  )
}

export function VoiceBar({ media }: { media: OfficeMedia }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const idle = 'grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-frost disabled:opacity-40'
  const hot = 'grid h-10 w-10 place-items-center rounded-full bg-ink text-paper disabled:opacity-40'

  return (
    <div ref={box} className="pointer-events-auto absolute end-3 bottom-16 z-30 sm:end-4 sm:bottom-4">
      {open ? (
        <div className="absolute end-0 bottom-full mb-2 w-64 rounded-2xl bg-paper p-3 text-ink shadow-card">
          <p className="text-[10px] font-bold tracking-[0.16em] text-ink/60 uppercase">{t('microphone')}</p>
          <DeviceList empty={t('noMics')} devices={media.mics} selected={media.micId} onPick={(id) => void media.chooseMic(id)} />
          <p className="mt-3 text-[10px] font-bold tracking-[0.16em] text-ink/60 uppercase">{t('headset')}</p>
          {media.heads.length === 0 ? (
            <p className="mt-1 text-xs text-ink/70">{t('browserHeadset')}</p>
          ) : (
            <DeviceList empty={t('noHeadsets')} devices={media.heads} selected={media.headId} onPick={(id) => void media.chooseHead(id)} />
          )}
        </div>
      ) : null}
      {media.error ? <p className="mb-2 max-w-64 rounded-2xl bg-paper px-3 py-2 text-xs font-medium text-danger shadow-pop">{media.error}</p> : null}
      {media.ready && !media.hearing ? (
        <button type="button" onClick={() => void media.unlock()} className="mb-2 block rounded-full bg-paper px-3 py-1.5 text-xs font-medium text-ink shadow-pop">
          {t('soundOn')}
        </button>
      ) : null}
      <div className="flex items-center gap-1 rounded-full bg-paper p-1 text-ink shadow-card">
        <button type="button" aria-pressed={media.mic} aria-label={media.mic ? t('muteMic') : t('unmuteMic')} disabled={!media.ready} onClick={() => void media.toggleMic()} className={media.mic ? idle : hot}>
          <MicMark off={!media.mic} />
        </button>
        <button type="button" aria-pressed={media.deaf} aria-label={media.deaf ? t('undeafen') : t('deafen')} disabled={!media.ready} onClick={() => void media.toggleDeaf()} className={media.deaf ? hot : idle}>
          <HeadMark off={media.deaf} />
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-label={t('soundSettings')}
          disabled={!media.ready}
          onClick={() => {
            const next = !open
            setOpen(next)
            if (next) void media.refreshDevices()
          }}
          className={open ? 'grid h-10 w-10 place-items-center rounded-full bg-frost text-ink disabled:opacity-40' : idle}
        >
          <Dots />
        </button>
      </div>
    </div>
  )
}

export type FloorMate = {
  id: string
  name: string
  face: string
  x: number
  z: number
  self: boolean
  since: number
}

export function formatStay(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}

export function floorMates(
  self: { id: string; name: string; face: string; x: number; z: number; since?: number } | null,
  others: { userId: string; name: string; face: string; x: number; z: number; joinedAt?: number }[],
): FloorMate[] {
  const people: FloorMate[] = []
  if (self) {
    people.push({
      id: self.id,
      name: self.name.trim(),
      face: self.face,
      x: self.x,
      z: self.z,
      self: true,
      since: self.since ?? 0,
    })
  }
  for (const person of others) {
    if (self && person.userId === self.id) continue
    people.push({
      id: person.userId,
      name: person.name.trim(),
      face: person.face,
      x: person.x,
      z: person.z,
      self: false,
      since: person.joinedAt ?? 0,
    })
  }
  return people
}

const hold = { value: false, listen: new Set<() => void>() }

function publishHold(next: boolean) {
  if (hold.value === next) return
  hold.value = next
  hold.listen.forEach((notify) => notify())
}

export function useOfficeListOpen() {
  const [open, setOpen] = useState(hold.value)
  useEffect(() => {
    const sync = () => setOpen(hold.value)
    hold.listen.add(sync)
    return () => {
      hold.listen.delete(sync)
    }
  }, [])
  return open
}

function useHeldTab(active: boolean) {
  const [held, setHeld] = useState(false)
  useEffect(() => {
    if (!active) {
      publishHold(false)
      return
    }
    const typing = (event: KeyboardEvent) => {
      const target = event.target
      return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    }
    const show = (next: boolean) => {
      setHeld(next)
      publishHold(next)
    }
    const down = (event: KeyboardEvent) => {
      if (event.code !== 'Tab' || typing(event)) return
      event.preventDefault()
      show(true)
    }
    const up = (event: KeyboardEvent) => {
      if (event.code !== 'Tab') return
      event.preventDefault()
      show(false)
    }
    const hide = () => show(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', hide)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', hide)
      show(false)
    }
  }, [active])
  return active && held
}

export function OfficeRoll({
  active,
  people,
  here,
  voices,
}: {
  active: boolean
  people: FloorMate[]
  here: { x: number; z: number }
  voices: VoicePerson[]
}) {
  const open = useHeldTab(active)
  const [now, setNow] = useState(() => Date.now())
  useLayoutEffect(() => {
    if (!open) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [open])
  const t = useT()
  if (!open) return null
  const speaking = new Set(voices.filter((person) => person.speaking).map((person) => person.id))
  const rows = people
    .map((person) => {
      const distance = person.self ? 0 : Math.hypot(person.x - here.x, person.z - here.z)
      return { ...person, distance, close: person.self || distance < VOICE_REACH }
    })
    .sort((a, b) => Number(b.self) - Number(a.self) || Number(b.close) - Number(a.close) || a.distance - b.distance || a.name.localeCompare(b.name))
  const others = Math.max(0, rows.length - 1)
  const mine = rows.find((person) => person.self)
  const visit = mine?.since ? formatStay(now - mine.since) : '0:00'
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4">
      <section className="w-full max-w-sm rounded-card bg-paper px-4 py-3 text-ink shadow-card">
        <p className="text-[10px] font-bold tracking-[0.16em] text-ink/60 uppercase">{t('inOffice')}</p>
        <p className="mt-1 text-sm text-ink/75">{others === 0 ? t('onlyOne') : others === 1 ? t('oneInside') : t('othersInside', { n: others })}</p>
        <div className="mt-3 rounded-2xl bg-frost px-3 py-2 text-ink">
          <p className="text-[10px] font-bold tracking-[0.16em] text-ink/60 uppercase">{t('thisVisit')}</p>
          <p className="font-bold text-4xl leading-none text-lift tabular-nums">{visit}</p>
        </div>
        <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-y-auto">
          {rows.map((person) => (
            <li key={person.id} className="flex items-center gap-2 rounded-2xl bg-mist/70 px-2 py-1.5">
              <span className={`block h-8 w-8 shrink-0 overflow-hidden rounded-full bg-frost ${speaking.has(person.id) ? 'ring-2 ring-lift' : ''}`} style={skinCropStyle('head', knownFace(person.face))} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{person.self ? (person.name ? t('youTag', { name: person.name }) : t('you')) : (person.name || t('guest'))}</span>
              <span className="shrink-0 text-end">
                <span className="block text-xs text-ink tabular-nums">{person.since ? formatStay(now - person.since) : '0:00'}</span>
                <span className={`block text-[10px] ${person.close ? 'font-medium text-lift' : 'text-ink/55'}`}>{person.self ? t('here') : person.close ? t('nearby') : t('far')}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink/55">{t('releaseTab')}</p>
      </section>
    </div>
  )
}

function DeviceList({ devices, selected, empty, onPick }: { devices: OfficeMedia['mics']; selected: string; empty: string; onPick: (id: string) => void }) {
  if (!devices.length) return <p className="mt-1 text-xs text-ink/70">{empty}</p>
  return (
    <ul className="mt-1 max-h-40 overflow-y-auto">
      {devices.map((device) => {
        const on = device.id === selected
        return (
          <li key={device.id}>
            <button type="button" onClick={() => onPick(device.id)} className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-ink ${on ? 'bg-frost font-medium' : 'hover:bg-frost/70'}`}>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${on ? 'bg-lift' : 'bg-transparent'}`} />
              <span className="truncate">{device.label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
