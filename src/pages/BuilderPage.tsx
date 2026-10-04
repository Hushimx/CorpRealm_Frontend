import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { AccountCard } from '../components/AccountCard'
import { MediaBar } from '../components/MediaBar'
import { OfficeRoll, VoiceBar, VoiceRoster, floorMates, useOfficeListOpen } from '../components/VoiceOverlay'
import { ComputerDesktop, useDeskSession } from '../components/ComputerDesktop'
import { KeyCap } from '../components/KeyCap'
import { BuiltStage } from '../components/scene/BuiltWorld'
import type { Motion, Presence } from '../components/scene/OfficeWorld'
import { builtBoards } from '../office/boards'
import { ChessGame, chessInReach } from '../chess'
import { XoGame } from '../xo'
import { clearHeld, holdKey, queueJump, queueSit } from '../office/input'
import { CATALOG, catalogThumb, type CatalogId } from '../office/catalog'
import {
  LIMITS,
  clampRoom,
  compileOffice,
  hitTest,
  isObjectTool,
  labelInk,
  objectLabel,
  normalizeOffice,
  roomsOverlap,
  snap,
  type BuildTool,
  type BuiltOffice,
  type Selection,
} from '../office/build'
import { ApiError, api } from '../net/api'
import { useOfficeMedia } from '../net/media'
import { presenceLine, useOfficeRoom } from '../net/room'
import { useOfficePeople } from '../net/people'
import { useSession } from '../net/session'
import { useAvatarStore } from '../store/avatar'
import { useActiveOffice, useOfficeStore } from '../store/offices'

const ROOM_COLORS = ['#e6eeff', '#e6e8ee', '#f3f6fc', '#8fb8ff', '#c4c6ce', '#ffffff']
const SWATCHES = ['#ffffff', '#f3f6fc', '#e6eeff', '#8fb8ff', '#3b82f6', '#2765ed', '#1447e5', '#e6e8ee', '#c4c6ce', '#8a8d98', '#14161c', '#000000']

const pads = [
  { key: 'w', label: 'W' },
  { key: 'a', label: 'A' },
  { key: 's', label: 'S' },
  { key: 'd', label: 'D' },
  { key: ' ', label: 'Jump' },
  { key: 'shift', label: 'Sprint' },
]

type Tool = BuildTool

export function BuilderPage() {
  const office = useActiveOffice()
  const offices = useOfficeStore((state) => state.offices)
  const setActive = useOfficeStore((state) => state.setActive)
  const create = useOfficeStore((state) => state.create)
  const remove = useOfficeStore((state) => state.remove)
  const rename = useOfficeStore((state) => state.rename)
  const setSize = useOfficeStore((state) => state.setSize)
  const setPaint = useOfficeStore((state) => state.setPaint)
  const addRoom = useOfficeStore((state) => state.addRoom)
  const patchRoom = useOfficeStore((state) => state.patchRoom)
  const removeRoom = useOfficeStore((state) => state.removeRoom)
  const addObject = useOfficeStore((state) => state.addObject)
  const patchObject = useOfficeStore((state) => state.patchObject)
  const removeObject = useOfficeStore((state) => state.removeObject)
  const name = useAvatarStore((state) => state.name)
  const face = useAvatarStore((state) => state.face)
  const outfit = useAvatarStore((state) => state.outfit)
  const pants = useAvatarStore((state) => state.pants)

  const [tool, setTool] = useState<Tool>('room')
  const [shelf, setShelf] = useState<CatalogId | null>(null)
  const [placementRot, setPlacementRot] = useState(0)
  const [brush, setBrush] = useState('#e6eeff')
  const [selected, setSelected] = useState<Selection | null>(null)
  const [walking, setWalking] = useState(false)
  const [chessOpen, setChessOpen] = useState(false)
  const [xoOpen, setXoOpen] = useState(false)
  const [solidCeiling, setSolidCeiling] = useState(false)
  const [notice, setNotice] = useState('')
  const [looking, setLooking] = useState(false)
  const [presence, setPresence] = useState<Presence>({ x: 0, z: 0, yaw: 0, room: 'Open floor', roomId: 'floor', nearSeat: false, sitting: false, atDesk: false, seatId: '' })
  const computer = useDeskSession(walking && presence.sitting, presence.atDesk)
  const people = useOfficePeople(office?.id ?? null)
  const deskBoards = useMemo(() => (office ? builtBoards(office) : []), [office])
  const chessTables = useMemo(
    () => office?.objects.flatMap((object) => (object.kind === 'chess' ? [{ id: object.id, x: object.x, z: object.z }] : [])) ?? [],
    [office],
  )
  const xoTables = useMemo(
    () => office?.objects.flatMap((object) => (object.kind === 'xo' ? [{ id: object.id, x: object.x, z: object.z }] : [])) ?? [],
    [office],
  )
  const chessSpot = walking && !presence.sitting && !computer.open ? chessInReach(presence.x, presence.z, chessTables) : null
  const xoSpot = walking && !presence.sitting && !computer.open && !chessSpot ? chessInReach(presence.x, presence.z, xoTables) : null
  const nearChess = Boolean(chessSpot)
  const nearXo = Boolean(xoSpot)
  const user = useSession((state) => state.user)
  const room = useOfficeRoom(walking && office ? office.id : null, walking && Boolean(user))
  const ear = useRef({ x: presence.x, z: presence.z, yaw: presence.yaw })
  const follow = useCallback((motion: Motion) => {
    ear.current = { x: motion.x, z: motion.z, yaw: motion.yaw }
    room.trackMotion(motion)
  }, [room.trackMotion])
  const media = useOfficeMedia(
    room.livekit,
    walking && room.connected,
    ear,
    room.others.map((person) => ({ userId: person.userId, x: person.x, z: person.z })),
  )
  const company = presenceLine({
    signedIn: Boolean(user),
    active: walking && Boolean(user),
    connected: room.connected,
    notice: room.notice,
    names: room.others.map((person) => person.name.trim() || 'Guest'),
  })
  const [invite, setInvite] = useState('')
  const [inviteNote, setInviteNote] = useState('')
  const serverOffices = useRef(false)
  const [scope, setScope] = useState(office?.id ?? '')
  if ((office?.id ?? '') !== scope) {
    setScope(office?.id ?? '')
    setWalking(false)
    setSelected(null)
    setNotice('')
    setShelf(null)
    setChessOpen(false)
    setXoOpen(false)
  }
  const activeSelection =
    selected && office && (selected.type === 'room' ? office.rooms.some((room) => room.id === selected.id) : office.objects.some((object) => object.id === selected.id))
      ? selected
      : null
  if (selected && !activeSelection) setSelected(null)

  useEffect(() => {
    if (!user) return
    let stop = false
    serverOffices.current = false
    void (async () => {
      const rows = await api<unknown[]>('/offices')
      if (stop) return
      const built = rows.flatMap((row) => {
        if ((row as { kind?: string }).kind === 'studio') return []
        const next = normalizeOffice(row)
        return next ? [next] : []
      })
      if (!built.length) {
        const created = normalizeOffice(await api('/offices', { method: 'POST', body: JSON.stringify({ name: 'Annex' }) }))
        if (created) built.push(created)
      }
      if (!built.length || stop) return
      const activeId = useOfficeStore.getState().activeId
      useOfficeStore.setState({ offices: built, activeId: built.some((item) => item.id === activeId) ? activeId : built[0].id })
      serverOffices.current = true
    })()
    return () => {
      stop = true
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    let timer = 0
    const unsub = useOfficeStore.subscribe((state, prev) => {
      if (!serverOffices.current) return
      const current = state.offices.find((item) => item.id === state.activeId)
      const before = prev.offices.find((item) => item.id === current?.id)
      if (!current || current === before) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        void api(`/offices/${current.id}`, { method: 'PUT', body: JSON.stringify(current) })
      }, 300)
    })
    return () => {
      unsub()
      window.clearTimeout(timer)
    }
  }, [user?.id])

  useEffect(() => {
    room.notePose(presence)
  }, [presence, room.notePose])

  useEffect(() => {
    const sync = () => setLooking(document.pointerLockElement instanceof HTMLCanvasElement)
    document.addEventListener('pointerlockchange', sync)
    return () => document.removeEventListener('pointerlockchange', sync)
  }, [])

  useEffect(() => {
    if (walking) return
    const onKey = (event: KeyboardEvent) => {
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
      if (!selected) return
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault()
        if (selected.type === 'room') removeRoom(selected.id)
        else removeObject(selected.id)
        setSelected(null)
      }
      if ((event.key === 'r' || event.key === 'R') && tool === 'select' && selected.type === 'object') {
        const object = office?.objects.find((item) => item.id === selected.id)
        if (object) patchObject(object.id, { rot: (object.rot + Math.PI / 2) % (Math.PI * 2) })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [office, patchObject, removeObject, removeRoom, selected, tool, walking])

  const selectedRoom = office && activeSelection?.type === 'room' ? office.rooms.find((room) => room.id === activeSelection.id) : null
  const selectedObject = office && activeSelection?.type === 'object' ? office.objects.find((object) => object.id === activeSelection.id) : null

  function drawRoom(rect: { x: number; z: number; w: number; d: number }) {
    if (!office) return
    if (office.rooms.length >= LIMITS.rooms) {
      setNotice('This office already has 16 rooms.')
      return
    }
    const room = clampRoom(office, {
      id: crypto.randomUUID(),
      name: `Room ${office.rooms.length + 1}`,
      ...rect,
      floor: ROOM_COLORS[office.rooms.length % ROOM_COLORS.length],
      walls: true,
    })
    if (roomsOverlap(office.rooms, room) || !addRoom(room)) {
      setNotice('That room overlaps another. Drag it onto open floor.')
      return
    }
    setSelected({ type: 'room', id: room.id })
    setNotice('')
  }

  function turnPlacement(direction: 1 | -1) {
    setPlacementRot((current) => {
      const next = (current + direction * (Math.PI / 2)) % (Math.PI * 2)
      return next < 0 ? next + Math.PI * 2 : next
    })
  }

  function placeObject(x: number, z: number, rot: number) {
    if (!office || !isObjectTool(tool)) return
    if (office.objects.length >= LIMITS.objects) {
      setNotice('This office already has 60 objects.')
      return
    }
    const object = { id: crypto.randomUUID(), kind: tool, x, z, rot, color: '' }
    if (!addObject(object)) return
    setSelected({ type: 'object', id: object.id })
    setNotice('')
  }

  function paintAt(hit: Selection | null) {
    if (hit?.type === 'room') {
      patchRoom(hit.id, { floor: brush })
      setSelected(hit)
    } else if (hit?.type === 'object') {
      patchObject(hit.id, { color: brush })
      setSelected(hit)
    } else {
      setPaint('floor', brush)
    }
    setNotice('')
  }

  function moveSelection(selection: Selection, x: number, z: number) {
    if (selection.type === 'room') patchRoom(selection.id, { x, z })
    else patchObject(selection.id, { x, z })
  }

  if (!office) {
    return (
      <main className="px-5 py-16 text-ink">
        <h1 className="font-black text-4xl">No offices yet.</h1>
        <button
          type="button"
          onClick={() => void makeOffice()}
          className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-paper"
        >
          New office
        </button>
      </main>
    )
  }

  async function makeOffice() {
    if (!user) {
      create()
      return
    }
    const created = normalizeOffice(await api('/offices', { method: 'POST', body: JSON.stringify({ name: `Office ${offices.length + 1}` }) }))
    if (!created) return
    useOfficeStore.setState((state) => ({
      offices: [...state.offices.filter((item) => item.id !== created.id), created],
      activeId: created.id,
    }))
  }

  async function deleteOffice(id: string) {
    if (user) {
      try {
        await api(`/offices/${id}`, { method: 'DELETE' })
      } catch {
        return
      }
    }
    remove(id)
  }

  async function inviteMember() {
    if (!office) return
    try {
      await api(`/offices/${office.id}/members`, { method: 'POST', body: JSON.stringify({ email: invite }) })
      setInvite('')
      setInviteNote('They can walk this office in.')
    } catch (caught) {
      setInviteNote(caught instanceof ApiError ? caught.message : 'Could not add that email.')
    }
  }

  function openChess() {
    clearHeld()
    if (document.pointerLockElement) document.exitPointerLock()
    if (chessSpot && room.connected) room.claimChess(chessSpot.id)
    setChessOpen(true)
  }

  function openXo() {
    clearHeld()
    if (document.pointerLockElement) document.exitPointerLock()
    if (xoSpot && room.connected) room.claimXo(xoSpot.id)
    setXoOpen(true)
  }

  return (
    <div className={`relative h-[calc(100svh-4.25rem)] bg-night ${looking ? 'cursor-none' : ''}`}>
      <BuiltStage
        office={office}
        parts={{ face, outfit, pants }}
        walking={walking}
        paused={computer.open || chessOpen || xoOpen}
        enclosed={walking || solidCeiling}
        selected={walking ? null : activeSelection}
        tool={tool}
        others={room.others}
        onPresence={setPresence}
        onSelect={setSelected}
        onMove={moveSelection}
        onDrawRoom={drawRoom}
        onPlaceObject={placeObject}
        onPaint={paintAt}
        placementRot={placementRot}
        onTurn={turnPlacement}
        place={room.place}
        onStand={room.standAt}
        onMotion={follow}
        screens={media.screens}
        cameras={media.cameras}
      />
      <div className="pointer-events-none absolute inset-0">
        {walking ? (
          <WalkHud
            office={office}
            presence={presence}
            name={name}
            looking={looking}
            computerOpen={computer.open}
            nearChess={nearChess}
            nearXo={nearXo}
            chessOpen={chessOpen}
            xoOpen={xoOpen}
            onUseComputer={computer.show}
            onChess={openChess}
            onXo={openXo}
            onBack={() => {
              setWalking(false)
              setChessOpen(false)
              setXoOpen(false)
              if (document.pointerLockElement) document.exitPointerLock()
            }}
            company={company}
            media={media}
            voice={Boolean(room.livekit)}
            faces={{ ...(user ? { [user.id]: face } : {}), ...Object.fromEntries(room.others.map((person) => [person.userId, person.face])) }}
            mates={floorMates(user ? { id: user.id, name, face, x: presence.x, z: presence.z, since: room.joinedAt } : null, room.others)}
            listed={room.connected}
          />
        ) : (
          <div className="pointer-events-none absolute inset-0">
            <aside className="pointer-events-auto absolute top-3 left-3 z-10 max-h-[42svh] w-[16.5rem] max-w-[calc(100%-1.5rem)] overflow-y-auto overscroll-contain rounded-card bg-paper p-4 text-ink shadow-card sm:top-4 sm:left-4">
              <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Build mode</p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <h1 className="font-bold text-3xl leading-none">The lot</h1>
                <button type="button" onClick={() => void makeOffice()} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                  New office
                </button>
              </div>
              <label className="mt-3 block text-xs text-ink/70">
                Office
                <select
                  value={office.id}
                  onChange={(event) => setActive(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-lift"
                >
                  {offices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name.trim() || 'Office'}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-xs text-ink/70">Name</span>
                <input
                  value={office.name}
                  onChange={(event) => rename(event.target.value)}
                  maxLength={32}
                  className="mt-1 w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-lift"
                />
              </label>
              <label className="mt-3 block text-xs text-ink/70">
                Lot width {office.width}m
                <input
                  type="range"
                  min={10}
                  max={36}
                  step={1}
                  value={office.width}
                  onChange={(event) => setSize(Number(event.target.value), office.depth)}
                  className="mt-1 w-full accent-lift"
                />
              </label>
              <label className="mt-2 block text-xs text-ink/70">
                Lot depth {office.depth}m
                <input
                  type="range"
                  min={8}
                  max={28}
                  step={1}
                  value={office.depth}
                  onChange={(event) => setSize(office.width, Number(event.target.value))}
                  className="mt-1 w-full accent-lift"
                />
              </label>
              <button type="button" aria-pressed={solidCeiling} onClick={() => setSolidCeiling((value) => !value)} className={`mt-3 ${chipClass(solidCeiling)}`}>
                Solid ceiling
              </button>
              <p className="mt-3 text-xs leading-relaxed text-ink/60">{buildHint(tool)}</p>
              {notice ? <p className="mt-2 text-xs font-medium text-danger">{notice}</p> : null}
              {user ? (
                <label className="mt-3 block">
                  <span className="text-xs text-ink/70">Invite by email</span>
                  <span className="mt-1 flex gap-1.5">
                    <input
                      value={invite}
                      onChange={(event) => setInvite(event.target.value)}
                      type="email"
                      placeholder="name@studio.test"
                      className="min-w-0 flex-1 rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink/40 focus-visible:border-lift"
                    />
                    <button type="button" onClick={() => void inviteMember()} className="rounded-full bg-ink px-3 py-2 text-xs font-bold text-paper">
                      Add
                    </button>
                  </span>
                  {inviteNote ? <span className="mt-1 block text-xs text-ink/70">{inviteNote}</span> : null}
                </label>
              ) : null}
              <AccountCard />
              <button type="button" onClick={() => void deleteOffice(office.id)} className="mt-3 text-sm font-medium text-danger">
                Delete office
              </button>
            </aside>

            {tool === 'paint' ? (
              <aside className="pointer-events-auto absolute top-3 right-3 z-10 w-64 rounded-card bg-paper p-3 text-ink shadow-card sm:top-4 sm:right-4">
                <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Paint</p>
                <div className="mt-2">
                  <ColorField label="Brush" value={brush} onChange={setBrush} />
                  <Swatches value={brush} onChange={setBrush} />
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setPaint('floor', brush)} className={chipClass(false)}>Open floor</button>
                  <button type="button" onClick={() => setPaint('wall', brush)} className={chipClass(false)}>Walls</button>
                  <button type="button" onClick={() => setPaint('trim', brush)} className={chipClass(false)}>Trim</button>
                  <button type="button" onClick={() => setPaint('ceiling', brush)} className={chipClass(false)}>Ceiling</button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink/60">Click a room to color its floor, or an object to color its main surface.</p>
              </aside>
            ) : null}

            {selectedRoom && tool !== 'paint' ? (
              <aside className="pointer-events-auto absolute top-3 right-3 z-10 w-64 rounded-card bg-paper p-3 text-ink shadow-card sm:top-4 sm:right-4">
                <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">Room</p>
                <input
                  value={selectedRoom.name}
                  onChange={(event) => patchRoom(selectedRoom.id, { name: event.target.value })}
                  maxLength={24}
                  className="mt-2 w-full rounded-xl border border-ink/15 bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-lift"
                />
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <NumberField label="Width" value={selectedRoom.w} onChange={(w) => patchRoom(selectedRoom.id, { w })} />
                  <NumberField label="Depth" value={selectedRoom.d} onChange={(d) => patchRoom(selectedRoom.id, { d })} />
                </div>
                <div className="mt-2">
                  <ColorField label="Floor" value={selectedRoom.floor} onChange={(floor) => patchRoom(selectedRoom.id, { floor })} />
                  <Swatches value={selectedRoom.floor} onChange={(floor) => patchRoom(selectedRoom.id, { floor })} />
                </div>
                <button type="button" aria-pressed={selectedRoom.walls} onClick={() => patchRoom(selectedRoom.id, { walls: !selectedRoom.walls })} className={`mt-2 ${chipClass(selectedRoom.walls)}`}>
                  {selectedRoom.walls ? 'Walls on' : 'Open floor'}
                </button>
                <button type="button" onClick={() => { removeRoom(selectedRoom.id); setSelected(null) }} className="mt-3 block text-sm font-medium text-danger">
                  Delete room
                </button>
              </aside>
            ) : null}

            {selectedObject && tool !== 'paint' ? (
              <aside className="pointer-events-auto absolute top-3 right-3 z-10 w-64 rounded-card bg-paper p-3 text-ink shadow-card sm:top-4 sm:right-4">
                <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{objectLabel(selectedObject.kind)}</p>
                <div className="mt-2">
                  <ColorField label="Accent" value={selectedObject.color || '#2765ed'} onChange={(color) => patchObject(selectedObject.id, { color })} />
                  <Swatches value={selectedObject.color} onChange={(color) => patchObject(selectedObject.id, { color })} />
                  <button type="button" onClick={() => patchObject(selectedObject.id, { color: '' })} className="mt-2 text-sm font-medium text-lift underline decoration-lift/40 underline-offset-2">
                    Original colors
                  </button>
                </div>
                <button type="button" onClick={() => patchObject(selectedObject.id, { rot: (selectedObject.rot + Math.PI / 2) % (Math.PI * 2) })} className="mt-3 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-paper">
                  Rotate
                </button>
                <button type="button" onClick={() => { removeObject(selectedObject.id); setSelected(null) }} className="mt-3 block text-sm font-medium text-danger">
                  Delete object
                </button>
              </aside>
            ) : null}

            <CatalogBar tool={tool} shelf={shelf} onTool={setTool} onShelf={setShelf} onTurn={turnPlacement} onLive={() => setWalking(true)} />
          </div>
        )}
      </div>
      {computer.open ? (
        <ComputerDesktop
          officeId={office.id}
          boards={deskBoards}
          people={people}
          onLeave={computer.dismiss}
          onStand={() => {
            computer.dismiss()
            queueSit()
          }}
        />
      ) : null}
      {chessOpen && chessSpot ? (
        <ChessGame
          onClose={() => setChessOpen(false)}
          shared={
            room.connected && room.chess[chessSpot.id]
              ? {
                  game: room.chess[chessSpot.id].game,
                  side: room.chess[chessSpot.id].white === room.sessionId ? 'w' : room.chess[chessSpot.id].black === room.sessionId ? 'b' : null,
                  onMove: (move) => room.moveChess(chessSpot.id, move.from, move.to, move.promotion),
                }
              : undefined
          }
        />
      ) : null}
      {xoOpen && xoSpot ? (
        <XoGame
          onClose={() => setXoOpen(false)}
          shared={
            room.connected && room.xo[xoSpot.id]
              ? {
                  game: room.xo[xoSpot.id].game,
                  side: room.xo[xoSpot.id].x === room.sessionId ? 'x' : room.xo[xoSpot.id].o === room.sessionId ? 'o' : null,
                  full: Boolean(room.xo[xoSpot.id].x && room.xo[xoSpot.id].o),
                  onMove: (index) => room.moveXo(xoSpot.id, index),
                  onReset: () => room.resetXo(xoSpot.id),
                }
              : undefined
          }
        />
      ) : null}
    </div>
  )
}

function SeatKey({
  sitting,
  nearSeat,
  nearChess,
  nearXo,
  frozen,
  onChess,
  onXo,
}: {
  sitting: boolean
  nearSeat: boolean
  nearChess: boolean
  nearXo: boolean
  frozen: boolean
  onChess: () => void
  onXo: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat || frozen) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select')) return
      if (!sitting && nearChess) {
        event.preventDefault()
        onChess()
        return
      }
      if (!sitting && nearXo) {
        event.preventDefault()
        onXo()
        return
      }
      if (!sitting && !nearSeat) return
      event.preventDefault()
      queueSit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frozen, nearChess, nearSeat, nearXo, onChess, onXo, sitting])
  return null
}

function WalkHud({
  office,
  presence,
  name,
  looking,
  computerOpen,
  nearChess,
  nearXo,
  chessOpen,
  xoOpen,
  onUseComputer,
  onChess,
  onXo,
  onBack,
  company,
  media,
  voice,
  faces,
  mates,
  listed,
}: {
  office: BuiltOffice
  presence: Presence
  name: string
  looking: boolean
  computerOpen: boolean
  nearChess: boolean
  nearXo: boolean
  chessOpen: boolean
  xoOpen: boolean
  onUseComputer: () => void
  onChess: () => void
  onXo: () => void
  onBack: () => void
  company: string
  media: ReturnType<typeof useOfficeMedia>
  voice: boolean
  faces: Record<string, string>
  mates: ReturnType<typeof floorMates>
  listed: boolean
}) {
  const listOpen = useOfficeListOpen()
  return (
    <>
      <aside className="pointer-events-auto absolute top-3 left-3 max-w-[16rem] rounded-card bg-paper px-4 py-3 text-ink shadow-card sm:top-4 sm:left-4">
        <p className="text-xs font-bold tracking-[0.16em] text-ink/60 uppercase">{office.name.trim() || 'Office'}</p>
        <h1 className="mt-1 font-bold text-3xl leading-none">{presence.room}</h1>
        <p className="mt-1 text-sm text-ink/75">{name.trim() || 'Unnamed'} is on the floor</p>
        <p className="mt-1 text-xs text-ink/70">{company}</p>
        {voice ? <MediaBar media={media} /> : <p className="mt-2 text-xs text-ink/60">Voice server is not running.</p>}
        <p className="mt-2 text-xs leading-relaxed text-ink/60">W A S D to move. Shift to sprint. Space to jump. E sits on a chair. A desk opens the computer. Chess and XO tables open a game. Hold Tab for this visit and everyone inside. Esc releases the cursor.</p>
        <button type="button" onClick={onBack} className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-bold text-paper">
          Back to builder
        </button>
      </aside>
      <div className="absolute top-3 right-3 flex flex-col items-end gap-3 sm:top-4 sm:right-4">
        {voice ? <VoiceRoster media={media} faces={faces} /> : null}
        <aside className="pointer-events-none rounded-card bg-paper p-2 text-ink shadow-card">
          <Plan office={office} selected={null} tool="select" presence={presence} />
        </aside>
      </div>
      <OfficeRoll active={listed} people={mates} here={{ x: presence.x, z: presence.z }} voices={media.voices} />
      {voice ? <VoiceBar media={media} /> : null}
      {looking || listOpen ? null : (
        <div className="absolute inset-0 flex items-center justify-center px-4">
          <p className="flex max-w-xl flex-wrap items-center justify-center gap-1.5 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop">
            <KeyCap name="click" alt="Click" className="h-8 w-auto" />
            <span>the floor or</span>
            <KeyCap name="w" alt="W" className="h-8 w-auto" />
            <KeyCap name="a" alt="A" className="h-8 w-auto" />
            <KeyCap name="s" alt="S" className="h-8 w-auto" />
            <KeyCap name="d" alt="D" className="h-8 w-auto" />
            <KeyCap name="esc" alt="Esc" className="h-8 w-auto" />
            <span>returns the cursor.</span>
          </p>
        </div>
      )}
      {!computerOpen && presence.sitting && presence.atDesk ? (
        <div className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-24">
          <button
            type="button"
            onClick={onUseComputer}
            className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper shadow-pop"
          >
            Use computer
          </button>
          <button
            type="button"
            onClick={() => queueSit()}
            className="flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop"
          >
            <KeyCap name="e" alt="E" className="h-8 w-auto" />
            Stand up
          </button>
        </div>
      ) : !computerOpen && !chessOpen && !xoOpen && nearChess && !presence.sitting ? (
        <button
          type="button"
          onClick={onChess}
          className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop sm:bottom-24"
        >
          <KeyCap name="e" alt="E" className="h-8 w-auto" />
          Play chess
        </button>
      ) : !computerOpen && !chessOpen && !xoOpen && nearXo && !presence.sitting ? (
        <button
          type="button"
          onClick={onXo}
          className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop sm:bottom-24"
        >
          <KeyCap name="e" alt="E" className="h-8 w-auto" />
          Play XO
        </button>
      ) : !computerOpen && (presence.sitting || presence.nearSeat) ? (
        <button
          type="button"
          onClick={() => queueSit()}
          className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop sm:bottom-24"
        >
          <KeyCap name="e" alt="E" className="h-8 w-auto" />
          {presence.sitting ? 'Stand up' : 'Sit down'}
        </button>
      ) : null}
      <SeatKey sitting={presence.sitting} nearSeat={presence.nearSeat} nearChess={nearChess} nearXo={nearXo} frozen={computerOpen || chessOpen || xoOpen} onChess={onChess} onXo={onXo} />
      <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-1.5 sm:bottom-4">
        {pads.map((pad) => (
          <button
            key={pad.key}
            type="button"
            aria-label={pad.label}
            className="group rounded-md p-0"
            onPointerDown={(event) => {
              event.preventDefault()
              if (pad.key === ' ') queueJump()
              else holdKey(pad.key, true)
            }}
            onPointerUp={() => holdKey(pad.key, false)}
            onPointerLeave={() => holdKey(pad.key, false)}
            onPointerCancel={() => holdKey(pad.key, false)}
          >
            <KeyCap name={pad.key} alt={pad.label} />
          </button>
        ))}
      </div>
    </>
  )
}

function Plan({
  office,
  selected,
  tool,
  presence,
  onSelect,
  onPlace,
  onMove,
}: {
  office: BuiltOffice
  selected: Selection | null
  tool: Tool
  presence?: Presence
  onSelect?: (selection: Selection | null) => void
  onPlace?: (x: number, z: number) => void
  onMove?: (selection: Selection & { x: number; z: number }) => void
}) {
  const compiled = useMemo(() => compileOffice(office), [office])
  const drag = useRef<null | (Selection & { dx: number; dz: number })>(null)
  const halfW = office.width / 2
  const halfD = office.depth / 2
  const interactive = Boolean(onPlace)

  function locate(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const view = event.currentTarget.viewBox.baseVal
    const x = view.x + ((event.clientX - bounds.left) / bounds.width) * view.width
    const z = view.y + ((event.clientY - bounds.top) / bounds.height) * view.height
    return { x, z }
  }

  return (
    <svg
      viewBox={`${-halfW - 1.4} ${-halfD - 1.2} ${office.width + 2.8} ${office.depth + 2.8}`}
      className={`w-full touch-none rounded-2xl bg-frost ${interactive ? 'mt-3 h-52 cursor-crosshair' : 'h-36'}`}
      role="img"
      aria-label="Office plan"
      onPointerDown={(event) => {
        if (!interactive) return
        event.preventDefault()
        const point = locate(event)
        if (tool !== 'select') {
          onPlace?.(snap(point.x), snap(point.z))
          return
        }
        const hit = hitTest(office, point.x, point.z)
        onSelect?.(hit)
        if (!hit) return
        const current = hit.type === 'room' ? office.rooms.find((room) => room.id === hit.id) : office.objects.find((object) => object.id === hit.id)
        if (!current) return
        drag.current = { ...hit, dx: current.x - point.x, dz: current.z - point.z }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const active = drag.current
        if (!active) return
        const point = locate(event)
        onMove?.({ ...active, x: snap(point.x + active.dx), z: snap(point.z + active.dz) })
      }}
      onPointerUp={() => {
        drag.current = null
      }}
    >
      <rect x={-halfW} y={-halfD} width={office.width} height={office.depth} fill={office.floor} stroke="#000000" strokeWidth={0.16} />
      {office.rooms.map((room) => (
        <g key={room.id}>
          <rect
            x={room.x - room.w / 2}
            y={room.z - room.d / 2}
            width={room.w}
            height={room.d}
            fill={room.floor}
            stroke={selected?.type === 'room' && selected.id === room.id ? '#2765ed' : '#000000'}
            strokeWidth={selected?.type === 'room' && selected.id === room.id ? 0.28 : 0.1}
          />
          <text
            x={room.x}
            y={room.z}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.min(1, room.w / 7)}
            fill={labelInk(room.floor)}
            pointerEvents="none"
          >
            {room.name.trim() || 'Room'}
          </text>
        </g>
      ))}
      {compiled.walls.map((wall, index) => (
        <rect
          key={`${index}-${wall.x}-${wall.z}`}
          x={wall.x - wall.w / 2}
          y={wall.z - wall.d / 2}
          width={wall.w}
          height={wall.d}
          fill={office.wall}
          stroke="#000000"
          strokeOpacity={0.35}
          strokeWidth={0.04}
          pointerEvents="none"
        />
      ))}
      <rect x={-1.6} y={halfD - 0.18} width={3.2} height={0.36} fill="#ffffff" pointerEvents="none" />
      <text x={0} y={halfD + 0.85} textAnchor="middle" fontSize="0.7" fill="#000000" pointerEvents="none">
        Door
      </text>
      {office.objects.map((object) => (
        <rect
          key={object.id}
          x={object.x - 0.38}
          y={object.z - 0.38}
          width={0.76}
          height={0.76}
          rx={0.12}
          fill={object.color || '#000000'}
          stroke={selected?.type === 'object' && selected.id === object.id ? '#2765ed' : '#000000'}
          strokeWidth={0.08}
          transform={`rotate(${(object.rot * 180) / Math.PI} ${object.x} ${object.z})`}
          pointerEvents="none"
        />
      ))}
      {presence ? <circle cx={presence.x} cy={presence.z} r={0.45} fill="#2765ed" /> : null}
    </svg>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-xl bg-frost px-2.5 py-2 text-sm text-ink">
      {label}
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-9 cursor-pointer rounded border border-ink/15 bg-paper"
      />
    </label>
  )
}

function Swatches({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type="button"
          aria-label={swatch}
          aria-pressed={value.toLowerCase() === swatch}
          onClick={() => onChange(swatch)}
          className={`h-6 w-6 rounded-full border border-ink/20 ${value.toLowerCase() === swatch ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
          style={{ backgroundColor: swatch }}
        />
      ))}
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-ink/70">
      {label}
      <input
        type="number"
        min={3}
        step={0.5}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        className="mt-1 w-full rounded-xl border border-ink/15 bg-paper px-2 py-1.5 text-sm text-ink outline-none focus-visible:border-lift"
      />
    </label>
  )
}

function CatalogBar({
  tool,
  shelf,
  onTool,
  onShelf,
  onTurn,
  onLive,
}: {
  tool: Tool
  shelf: CatalogId | null
  onTool: (tool: Tool) => void
  onShelf: (shelf: CatalogId | null) => void
  onTurn: (direction: 1 | -1) => void
  onLive: () => void
}) {
  const group = CATALOG.find((item) => item.id === shelf)
  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-10 sm:inset-x-4 sm:bottom-4">
      {group ? (
        <div className="mb-2 flex gap-2 overflow-x-auto rounded-card bg-paper p-2 text-ink shadow-card">
          {group.kinds.map((kind) => {
            const label = objectLabel(kind)
            const selected = tool === kind
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={selected}
                aria-label={label}
                onClick={() => onTool(kind)}
                className={`flex w-[5.5rem] shrink-0 flex-col items-center gap-1 rounded-2xl px-1.5 py-1.5 ${selected ? 'bg-ink' : 'bg-frost'}`}
              >
                <img src={catalogThumb(kind)} alt="" width={160} height={160} draggable={false} className="h-16 w-16 rounded-xl bg-frost object-contain" />
                <span className={`text-center text-[11px] font-medium leading-tight ${selected ? 'text-paper' : 'text-ink'}`}>{label}</span>
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="flex items-center gap-2 rounded-card bg-paper p-2 text-ink shadow-card">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <button type="button" aria-pressed={tool === 'select'} onClick={() => onTool('select')} className={chipClass(tool === 'select')}>Hand</button>
          <button type="button" aria-pressed={tool === 'room'} onClick={() => onTool('room')} className={chipClass(tool === 'room')}>Room</button>
          <button type="button" aria-pressed={tool === 'paint'} onClick={() => onTool('paint')} className={chipClass(tool === 'paint')}>Paint</button>
          {isObjectTool(tool) ? (
            <>
              <button type="button" onClick={() => onTurn(-1)} aria-label="Rotate left" className={chipClass(false)}>
                ↺
              </button>
              <button type="button" onClick={() => onTurn(1)} aria-label="Rotate right" className={chipClass(false)}>
                ↻
              </button>
            </>
          ) : null}
          <span className="mx-1 h-6 w-px shrink-0 bg-ink/15" />
          {CATALOG.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={shelf === item.id}
              onClick={() => onShelf(shelf === item.id ? null : item.id)}
              className={`shrink-0 ${chipClass(shelf === item.id)}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={onLive} className="shrink-0 rounded-full bg-lift px-4 py-1.5 text-sm font-medium text-paper">
          Live
        </button>
      </div>
    </div>
  )
}

function buildHint(tool: Tool) {
  if (tool === 'room') return 'Drag a rectangle on the floor. A short click drops a 4m room. Right-drag orbits the camera.'
  if (tool === 'paint') return 'Click a room floor or an object. Right-drag orbits. Scroll zooms.'
  if (tool === 'select') return 'Drag a room or a piece to move it. Right-drag orbits. Scroll zooms. Delete removes the selection.'
  return 'Turn it with the arrows, the scroll wheel, or R before you click to place it. Right-drag orbits.'
}

function chipClass(selected: boolean) {
  return ['rounded-full px-3 py-1.5 text-sm font-medium', selected ? 'bg-ink text-paper' : 'bg-frost text-ink'].join(' ')
}
