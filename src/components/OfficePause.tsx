import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { MediaBar } from './MediaBar'
import type { OfficeMedia } from '../net/media'
import { useSession } from '../net/session'
import { usePlaySettings } from '../store/play'

export function OfficePause({
  overview,
  media,
  onResume,
  onWalkInside,
  onOverview,
}: {
  overview: boolean
  media: OfficeMedia
  onResume: () => void
  onWalkInside: () => void
  onOverview: () => void
}) {
  const user = useSession((state) => state.user)
  const logout = useSession((state) => state.logout)
  const ready = media.ready
  const refreshDevices = media.refreshDevices
  const fov = usePlaySettings((state) => state.fov)
  const sensitivity = usePlaySettings((state) => state.sensitivity)
  const voice = usePlaySettings((state) => state.voice)
  const output = usePlaySettings((state) => state.output)
  const setFov = usePlaySettings((state) => state.setFov)
  const setSensitivity = usePlaySettings((state) => state.setSensitivity)
  const setVoice = usePlaySettings((state) => state.setVoice)
  const setOutput = usePlaySettings((state) => state.setOutput)
  const savedMic = usePlaySettings((state) => state.micId)
  const savedHead = usePlaySettings((state) => state.headId)
  const setMicId = usePlaySettings((state) => state.setMicId)
  const setHeadId = usePlaySettings((state) => state.setHeadId)
  const local = useLocalDevices()

  useEffect(() => {
    if (ready) void refreshDevices()
  }, [ready, refreshDevices])

  return (
    <div className="pointer-events-auto absolute inset-0 z-40 grid place-items-center bg-ink/35 p-4">
      <section className="max-h-[min(42rem,calc(100svh-2rem))] w-full max-w-md overflow-y-auto rounded-card bg-paper p-4 text-ink shadow-card">
        <p className="text-xs font-bold tracking-[0.16em] text-ink/50 uppercase">Paused</p>
        <h2 className="mt-1 font-black text-3xl leading-none text-ink">Settings</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {overview ? (
            <button type="button" onClick={onWalkInside} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper">
              Walk inside
            </button>
          ) : (
            <button type="button" onClick={onResume} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper">
              Resume
            </button>
          )}
          {overview ? null : (
            <button type="button" onClick={onOverview} className="rounded-full bg-frost px-4 py-2 text-sm font-bold text-ink">
              Office overview
            </button>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <Slider label="Field of view" min={40} max={90} step={1} value={fov} display={`${Math.round(fov)}°`} onChange={setFov} />
          <Slider label="Mouse sensitivity" min={0.25} max={2.5} step={0.05} value={sensitivity} display={`${Math.round(sensitivity * 100)}%`} onChange={setSensitivity} />
          <Slider label="Voice volume" min={0} max={1} step={0.05} value={voice} display={`${Math.round(voice * 100)}%`} onChange={setVoice} />
          <Slider label="Output volume" min={0} max={1} step={0.05} value={output} display={`${Math.round(output * 100)}%`} onChange={setOutput} />
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/50 uppercase">Microphone</p>
          {ready ? (
            <button type="button" onClick={() => void media.toggleMic()} className={`mt-2 rounded-full px-3 py-1.5 text-xs font-bold ${media.mic ? 'bg-frost text-ink' : 'bg-ink text-paper'}`}>
              {media.mic ? 'Mute microphone' : 'Unmute microphone'}
            </button>
          ) : null}
          <DeviceSelect
            label="Input"
            devices={media.mics.length ? media.mics : local.mics}
            selected={media.micId || savedMic}
            empty={local.asked ? 'No microphones found.' : 'Allow the microphone to list inputs.'}
            onPick={(id) => {
              setMicId(id)
              if (ready) void media.chooseMic(id)
            }}
          />
          {!ready && !local.asked ? (
            <button type="button" onClick={() => void local.allow()} className="mt-2 rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
              Allow microphone
            </button>
          ) : null}
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/50 uppercase">Headphones</p>
          {ready ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void media.toggleDeaf()} className={`rounded-full px-3 py-1.5 text-xs font-bold ${media.deaf ? 'bg-ink text-paper' : 'bg-frost text-ink'}`}>
                {media.deaf ? 'Turn headphones on' : 'Deafen'}
              </button>
              {media.hearing ? null : (
                <button type="button" onClick={() => void media.unlock()} className="rounded-full bg-frost px-3 py-1.5 text-xs font-bold text-ink">
                  Turn sound on
                </button>
              )}
            </div>
          ) : null}
          <DeviceSelect
            label="Output"
            devices={media.heads.length ? media.heads : local.heads}
            selected={media.headId || savedHead}
            empty="This browser picks the headphones for you."
            onPick={(id) => {
              setHeadId(id)
              if (ready) void media.chooseHead(id)
            }}
          />
          {local.error ? <p className="mt-2 text-sm font-medium text-danger">{local.error}</p> : null}
          {media.error ? <p className="mt-2 text-sm font-medium text-danger">{media.error}</p> : null}
        </div>

        {media.ready ? <MediaBar media={media} /> : null}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 pt-3">
          {user ? <p className="w-full text-xs text-ink/70">Signed in as <span className="font-medium text-ink">{user.name.trim() || user.email}</span></p> : null}
          <Link to="/avatar" className="text-sm font-medium text-lift underline decoration-lift/40 underline-offset-2">
            Change avatar
          </Link>
          <Link to="/build" className="text-sm font-medium text-lift underline decoration-lift/40 underline-offset-2">
            Build an office
          </Link>
          {user ? (
            <button type="button" onClick={() => void logout()} className="text-sm font-medium text-ink">
              Log out
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-ink/55">Esc closes this menu.</p>
      </section>
    </div>
  )
}

function useLocalDevices() {
  const [mics, setMics] = useState<{ id: string; label: string }[]>([])
  const [heads, setHeads] = useState<{ id: string; label: string }[]>([])
  const [asked, setAsked] = useState(false)
  const [error, setError] = useState('')

  async function load(ask: boolean) {
    try {
      if (ask) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach((track) => track.stop())
        setAsked(true)
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((device) => device.kind === 'audioinput' && device.deviceId)
      const outputs = devices.filter((device) => device.kind === 'audiooutput' && device.deviceId)
      setMics(inputs.map((device, index) => ({ id: device.deviceId, label: device.label.trim() || `Microphone ${index + 1}` })))
      setHeads(outputs.map((device, index) => ({ id: device.deviceId, label: device.label.trim() || `Headphones ${index + 1}` })))
      setError('')
    } catch {
      setError('The microphone was blocked.')
    }
  }

  useEffect(() => {
    void load(false)
    const refresh = () => void load(false)
    navigator.mediaDevices?.addEventListener('devicechange', refresh)
    return () => navigator.mediaDevices?.removeEventListener('devicechange', refresh)
  }, [])

  return { mics, heads, asked, error, allow: () => load(true) }
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  display,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  display: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">
      <span className="flex items-baseline justify-between gap-3">
        <span>{label}</span>
        <span className="font-medium tracking-normal text-ink normal-case">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full accent-lift"
      />
    </label>
  )
}

function DeviceSelect({
  label,
  devices,
  selected,
  empty,
  onPick,
}: {
  label: string
  devices: { id: string; label: string }[]
  selected: string
  empty: string
  onPick: (id: string) => void
}) {
  if (devices.length === 0) return <p className="mt-2 text-sm text-ink/60">{empty}</p>
  const value = devices.some((device) => device.id === selected) ? selected : devices[0].id
  return (
    <label className="mt-2 block text-xs font-bold tracking-[0.14em] text-ink/50 uppercase">
      {label}
      <select value={value} onChange={(event) => onPick(event.target.value)} className="mt-1 w-full rounded-2xl border border-ink/15 bg-paper px-3 py-2 text-sm font-medium text-ink normal-case outline-none">
        {devices.map((device) => (
          <option key={device.id} value={device.id}>
            {device.label}
          </option>
        ))}
      </select>
    </label>
  )
}
