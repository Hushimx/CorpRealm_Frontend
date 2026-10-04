import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { AccountCard } from '../components/AccountCard'
import { AvatarStage } from '../components/scene/BlockyAvatar'
import { POSES, SKINS, skinCropStyle, type SkinId } from '../avatar/parts'
import { ApiError } from '../net/api'
import { useSession } from '../net/session'
import { useAvatarStore } from '../store/avatar'

export function AvatarPage() {
  const name = useAvatarStore((state) => state.name)
  const face = useAvatarStore((state) => state.face)
  const outfit = useAvatarStore((state) => state.outfit)
  const pants = useAvatarStore((state) => state.pants)
  const pose = useAvatarStore((state) => state.pose)
  const setName = useAvatarStore((state) => state.setName)
  const setFace = useAvatarStore((state) => state.setFace)
  const setOutfit = useAvatarStore((state) => state.setOutfit)
  const setPants = useAvatarStore((state) => state.setPants)
  const setPose = useAvatarStore((state) => state.setPose)
  const randomize = useAvatarStore((state) => state.randomize)
  const user = useSession((state) => state.user)
  const saveProfile = useSession((state) => state.saveProfile)
  const navigate = useNavigate()
  const hydrated = useRef('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user || hydrated.current === user.id) return
    hydrated.current = user.id
    setName(user.name)
    if ((SKINS as readonly string[]).includes(user.face)) setFace(user.face as SkinId)
    if ((SKINS as readonly string[]).includes(user.outfit)) setOutfit(user.outfit as SkinId)
    if ((SKINS as readonly string[]).includes(user.pants)) setPants(user.pants as SkinId)
  }, [setFace, setName, setOutfit, setPants, user])

  useEffect(() => {
    if (!user || hydrated.current !== user.id) return
    const timer = window.setTimeout(() => {
      void saveProfile({ name, face, outfit, pants })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [face, name, outfit, pants, saveProfile, user])

  async function enterOffice() {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name your avatar before you enter.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await saveProfile({ name: trimmed, face, outfit, pants, avatarReady: true })
      navigate('/office')
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save your avatar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative h-[calc(100svh-4.25rem)] bg-night">
      <AvatarStage parts={{ face, outfit, pants }} pose={pose} />
      <div className="pointer-events-none absolute inset-0">
        <aside className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 max-h-[46svh] overflow-y-auto rounded-card bg-paper p-4 text-ink shadow-card md:inset-auto md:top-4 md:left-4 md:max-h-[calc(100%-2rem)] md:w-80">
          <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Low-poly avatar</p>
          <AccountCard />
          {user && !user.avatarReady ? (
            <p className="mt-3 text-sm leading-relaxed text-ink/75">
              Choose a face, a shirt, and pants. The office stays closed until you keep this avatar.
            </p>
          ) : null}
          <label className="mt-3 block">
            <span className="text-xs text-ink/70">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Give them a name"
              maxLength={24}
              className="mt-1 w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
            />
          </label>

          <PartRow label="Face" crop="head" selected={face} onSelect={setFace} />
          <PartRow label="Shirt" crop="outfit" selected={outfit} onSelect={setOutfit} />
          <PartRow label="Pants" crop="pants" selected={pants} onSelect={setPants} />

          <p className="mt-4 text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Pose</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {POSES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={pose === item.id}
                onClick={() => setPose(item.id)}
                className={chipClass(pose === item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={randomize}
            className="mt-4 w-full rounded-full bg-lift px-3 py-2.5 text-sm font-medium text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Shuffle parts
          </button>
          {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void enterOffice()}
            className="mt-2 w-full rounded-full bg-ink px-3 py-2.5 text-sm font-medium text-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lift disabled:opacity-60"
          >
            {saving ? 'Saving…' : user?.avatarReady ? 'Enter the office' : 'Use this avatar'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-ink/60">
            Built on Kenney’s blocky characters. Mix a face, a shirt, and pants from the ready skins.
          </p>
        </aside>
        {name ? (
          <p className="absolute top-4 right-4 font-black text-3xl text-paper">{name}</p>
        ) : null}
      </div>
    </div>
  )
}

function PartRow({
  label,
  crop,
  selected,
  onSelect,
}: {
  label: string
  crop: 'head' | 'outfit' | 'pants'
  selected: SkinId
  onSelect: (id: SkinId) => void
}) {
  return (
    <div className="mt-4">
      <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{label}</p>
      <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
        {SKINS.map((id) => (
          <button
            key={id}
            type="button"
            aria-label={`${label} ${id.toUpperCase()}`}
            aria-pressed={selected === id}
            onClick={() => onSelect(id)}
            className={[
              'h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-frost',
              selected === id ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'ring-1 ring-ink/15',
            ].join(' ')}
          >
            <span className="block h-full w-full" style={skinCropStyle(crop, id)} />
          </button>
        ))}
      </div>
    </div>
  )
}

function chipClass(selected: boolean) {
  return [
    'rounded-full px-3 py-1.5 text-sm font-medium',
    selected ? 'bg-ink text-paper' : 'bg-frost text-ink',
  ].join(' ')
}
