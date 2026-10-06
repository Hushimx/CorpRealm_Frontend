import { doorId, doorInReach, toggleDoor, useDoors } from '../office/doors'
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyCap } from '../components/KeyCap'
import { OfficePause } from '../components/OfficePause'
import { OfficeStage, type Presence } from '../components/scene/OfficeWorld'
import { ChessGame, chessInReach } from '../chess'
import { XoGame } from '../xo'
import { ComputerDesktop, useDeskSession } from '../components/ComputerDesktop'
import { TaskBoard } from '../components/TaskBoard'
import { boardInReach, OFFICE_BOARDS } from '../office/boards'
import { clearHeld, holdKey, queueJump, queueSit } from '../office/input'
import { doors, props, rooms } from '../office/layout'
import { OfficeRoll, VoiceBar, VoiceRoster, floorMates, useOfficeListOpen } from '../components/VoiceOverlay'
import { useOfficeMedia } from '../net/media'
import { useOfficeRoom } from '../net/room'
import type { Motion } from '../components/scene/OfficeWorld'
import { useOfficePeople } from '../net/people'
import { knownCopy, roomCopy, useT } from '../i18n'
import { useSession } from '../net/session'
import { useAvatarStore } from '../store/avatar'

const mapPad = 1.6
const mapMinX = Math.min(...rooms.map((room) => room.x - room.w / 2)) - mapPad
const mapMinZ = Math.min(...rooms.map((room) => room.z - room.d / 2)) - mapPad
const mapMaxX = Math.max(...rooms.map((room) => room.x + room.w / 2)) + mapPad
const mapMaxZ = Math.max(...rooms.map((room) => room.z + room.d / 2)) + mapPad
const mapW = mapMaxX - mapMinX
const mapScale = mapW / 38
const STUDIO_CHESS = props.flatMap((prop) => (prop.kind === 'chess' ? [{ id: `${prop.x},${prop.z}`, x: prop.x, z: prop.z }] : []))
const STUDIO_XO = props.flatMap((prop) => (prop.kind === 'xo' ? [{ id: `${prop.x},${prop.z}`, x: prop.x, z: prop.z }] : []))

const pads = [
  { key: 'w', label: 'W' },
  { key: 'a', label: 'A' },
  { key: 's', label: 'S' },
  { key: 'd', label: 'D' },
  { key: ' ', label: 'jump' as const },
  { key: 'shift', label: 'sprint' as const },
]

export function OfficePage() {
  const name = useAvatarStore((state) => state.name)
  const face = useAvatarStore((state) => state.face)
  const outfit = useAvatarStore((state) => state.outfit)
  const pants = useAvatarStore((state) => state.pants)
  const [presence, setPresence] = useState<Presence>({
    x: 0,
    z: 5.4,
    yaw: 0,
    room: 'Open Workspace',
    roomId: 'open',
    nearSeat: false,
    sitting: false,
    atDesk: false,
    seatId: '',
  })
  const [looking, setLooking] = useState(false)
  const listOpen = useOfficeListOpen()
  const [overview, setOverview] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [openBoard, setOpenBoard] = useState<string | null>(null)
  const [chessOpen, setChessOpen] = useState(false)
  const [chessId, setChessId] = useState<string | null>(null)
  const [xoOpen, setXoOpen] = useState(false)
  const [xoId, setXoId] = useState<string | null>(null)
  const user = useSession((state) => state.user)
  const people = useOfficePeople('hq')
  const room = useOfficeRoom('hq', !overview)
  const ear = useRef({ x: presence.x, z: presence.z, yaw: presence.yaw })
  const follow = useCallback((motion: Motion) => {
    ear.current = { x: motion.x, z: motion.z, yaw: motion.yaw }
    room.trackMotion(motion)
  }, [room.trackMotion])
  const media = useOfficeMedia(
    room.livekit,
    !overview && room.connected,
    ear,
    room.others.map((person) => ({ userId: person.userId, x: person.x, z: person.z })),
  )
  const computer = useDeskSession(!overview && presence.sitting, presence.atDesk)
  const busy = overview || openBoard || computer.open || chessOpen || xoOpen
  const doorStates = useDoors(state => state.open)
  const movingDoors = useDoors(state => state.moving)
  const obstructedDoors = useDoors(state => state.obstructed)
  const nearDoor = busy || presence.sitting ? null : doorInReach(doors, presence.x, presence.z)
  const doorIsOpen = nearDoor ? Boolean(doorStates[doorId(nearDoor)]) : false
  const doorObstructed = nearDoor ? doorIsOpen && Boolean(obstructedDoors[doorId(nearDoor)]) : false
  const near = busy ? null : boardInReach(presence.x, presence.z)
  const nearChess = busy || presence.sitting ? null : chessInReach(presence.x, presence.z, STUDIO_CHESS)
  const nearXo = busy || presence.sitting || nearChess ? null : chessInReach(presence.x, presence.z, STUDIO_XO)
  const board = OFFICE_BOARDS.find((item) => item.id === openBoard) ?? null
  const t = useT()

  function openTasks(id: string) {
    clearHeld()
    if (document.pointerLockElement) document.exitPointerLock()
    setOpenBoard(id)
  }

  function openChess() {
    clearHeld()
    if (document.pointerLockElement) document.exitPointerLock()
    if (nearChess) {
      setChessId(nearChess.id)
      if (room.connected) room.claimChess(nearChess.id)
    }
    setChessOpen(true)
  }

  function openXo() {
    clearHeld()
    if (document.pointerLockElement) document.exitPointerLock()
    if (nearXo) {
      setXoId(nearXo.id)
      if (room.connected) room.claimXo(nearXo.id)
    }
    setXoOpen(true)
  }

  useEffect(() => {
    room.notePose(presence)
  }, [presence, room.notePose])

  useEffect(() => {
    const sync = () => setLooking(document.pointerLockElement instanceof HTMLCanvasElement)
    document.addEventListener('pointerlockchange', sync)
    return () => document.removeEventListener('pointerlockchange', sync)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyE' || event.repeat) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable=true], [role=textbox]')) return
      if (overview) return
      if (openBoard) {
        event.preventDefault()
        setOpenBoard(null)
        return
      }
      if (computer.open) return
      if (chessOpen) {
        event.preventDefault()
        setChessOpen(false)
        return
      }
      if (xoOpen) {
        event.preventDefault()
        setXoOpen(false)
        return
      }
      if (presence.sitting) {
        event.preventDefault()
        queueSit()
        return
      }
      if (nearDoor) {
        event.preventDefault()
        toggleDoor(nearDoor)
        return
      }
      if (near) {
        event.preventDefault()
        openTasks(near.id)
        return
      }
      if (nearChess) {
        event.preventDefault()
        openChess()
        return
      }
      if (nearXo) {
        event.preventDefault()
        openXo()
        return
      }
      if (!presence.nearSeat) return
      event.preventDefault()
      queueSit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chessOpen, computer.open, nearDoor, near, nearChess, nearXo, openBoard, overview, presence.nearSeat, presence.sitting, xoOpen])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Escape' || event.repeat) return
      const target = event.target
      if (target instanceof HTMLInputElement && target.type !== 'range') return
      if (target instanceof HTMLElement && target.closest('textarea, select, [contenteditable=true]')) return
      if (openBoard || computer.open || chessOpen || xoOpen) return
      setMenuOpen((open) => !open)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [chessOpen, computer.open, openBoard, xoOpen])

  function resume() {
    setMenuOpen(false)
    if (overview) return
    const canvas = document.querySelector('canvas')
    if (canvas instanceof HTMLCanvasElement) void canvas.requestPointerLock()
  }

  return (
    <div className={`relative h-svh bg-night ${looking && !menuOpen ? 'cursor-none' : ''}`}>
      <OfficeStage parts={{ face, outfit, pants }} others={room.others} onPresence={setPresence} onPlace={room.standAt} onMotion={follow} place={room.place} screens={media.screens} overview={overview} paused={menuOpen || board !== null || computer.open || chessOpen || xoOpen} />
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-3 end-3 flex flex-col items-end gap-3 sm:top-4 sm:end-4">
          {!overview && room.livekit ? <VoiceRoster media={media} faces={{ ...(user ? { [user.id]: face } : {}), ...Object.fromEntries(room.others.map((person) => [person.userId, person.face])) }} /> : null}
        <aside className="pointer-events-auto rounded-card bg-paper p-2 text-ink shadow-card" dir="ltr">
          <svg viewBox={`${mapMinX} ${mapMinZ} ${mapW} ${mapMaxZ - mapMinZ}`} className="h-36 w-48 sm:h-40 sm:w-56" role="img" aria-label={t('officeMap')}>
            {rooms.map((room) => (
              <g key={room.id}>
                <rect
                  x={room.x - room.w / 2}
                  y={room.z - room.d / 2}
                  width={room.w}
                  height={room.d}
                  fill={room.id === presence.roomId ? '#e6eeff' : '#ffffff'}
                  stroke="#000000"
                  strokeWidth={0.16 * mapScale}
                />
                <text
                  x={room.x}
                  y={room.z}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={1.15 * mapScale}
                  fill="#000000"
                >
                  {roomCopy(room.id, room.short, t)}
                </text>
              </g>
            ))}
            <circle cx={presence.x} cy={presence.z} r={0.55 * mapScale} fill="#2765ed" />
          </svg>
        </aside>
        </div>

        <OfficeRoll
          active={!overview && room.connected}
          people={floorMates(user ? { id: user.id, name, face, x: presence.x, z: presence.z, since: room.joinedAt } : null, room.others)}
          here={{ x: presence.x, z: presence.z }}
          voices={media.voices}
        />

        {overview && !menuOpen ? (
          <button
            type="button"
            onClick={() => setOverview(false)}
            className="pointer-events-auto absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-bold text-paper shadow-pop sm:bottom-24"
          >
            {t('walkInside')}
          </button>
        ) : null}

        {looking || overview || listOpen || menuOpen ? null : (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <p className="flex max-w-xl flex-wrap items-center justify-center gap-1.5 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop">
              <KeyCap name="click" alt={t('click')} className="h-8 w-auto" />
              <span>{t('or')}</span>
              <KeyCap name="w" alt="W" className="h-8 w-auto" />
              <KeyCap name="a" alt="A" className="h-8 w-auto" />
              <KeyCap name="s" alt="S" className="h-8 w-auto" />
              <KeyCap name="d" alt="D" className="h-8 w-auto" />
              <span>{t('cursorHides')}</span>
              <KeyCap name="esc" alt="Esc" className="h-8 w-auto" />
              <span>{t('forMenu')}</span>
            </p>
          </div>
        )}

        {!overview && !board && !computer.open && presence.sitting && presence.atDesk ? (
          <div className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-24">
            <button
              type="button"
              onClick={computer.show}
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper shadow-pop"
            >
              {t('useComputer')}
            </button>
            <button
              type="button"
              onClick={() => queueSit()}
              className="flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop"
            >
              <KeyCap name="e" alt="E" className="h-8 w-auto" />
              {t('standUp')}
            </button>
          </div>
        ) : !overview && !board && !computer.open && presence.sitting ? (
          <button
            type="button"
            onClick={() => queueSit()}
            className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop sm:bottom-24"
          >
            <KeyCap name="e" alt="E" className="h-8 w-auto" />
            {t('standUp')}
          </button>
        ) : nearDoor ? (
          <button type="button" onClick={() => toggleDoor(nearDoor)} disabled={doorObstructed}
            className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-lg disabled:opacity-70 sm:bottom-24">
            <KeyCap name="e" alt="E" className="h-8 w-auto" />
            <span className="flex flex-col items-start"><span>{doorObstructed ? t('stepAway') : doorIsOpen ? t('closeDoor') : t('openDoor')}</span><span className="text-xs text-ink/55">{knownCopy(nearDoor.label ?? '', t) || t('officeDoor')}{movingDoors[doorId(nearDoor)] ? doorIsOpen ? ` · ${t('opening')}` : ` · ${t('closing')}` : ''}</span></span>
          </button>
        ) : nearChess ? (
          <button
            type="button"
            onClick={openChess}
            className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop sm:bottom-24"
          >
            <KeyCap name="e" alt="E" className="h-8 w-auto" />
            {t('playChess')}
          </button>
        ) : nearXo ? (
          <button
            type="button"
            onClick={openXo}
            className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop sm:bottom-24"
          >
            <KeyCap name="e" alt="E" className="h-8 w-auto" />
            {t('playXo')}
          </button>
        ) : near ? (
          <button
            type="button"
            onClick={() => openTasks(near.id)}
            className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop sm:bottom-24"
          >
            <KeyCap name="e" alt="E" className="h-8 w-auto" />
            {t('openTasks')}
            <span className="text-ink/60">{knownCopy(near.title, t)}</span>
          </button>
        ) : !overview && presence.nearSeat ? (
          <button
            type="button"
            onClick={() => queueSit()}
            className="pointer-events-auto absolute bottom-20 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink shadow-pop sm:bottom-24"
          >
            <KeyCap name="e" alt="E" className="h-8 w-auto" />
            {t('sitDown')}
          </button>
        ) : null}

        {!overview && room.livekit ? <VoiceBar media={media} /> : null}
        {!overview && !board && <div className="pointer-events-auto absolute bottom-3 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-1.5 sm:bottom-4">
          {pads.map((pad) => (
            <button
              key={pad.key}
              type="button"
              aria-label={pad.label === 'jump' || pad.label === 'sprint' ? t(pad.label) : pad.label}
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
              <KeyCap name={pad.key} alt={pad.label === 'jump' || pad.label === 'sprint' ? t(pad.label) : pad.label} />
            </button>
          ))}
        </div>}
      </div>
      {board ? <TaskBoard boardId={board.id} title={board.title} people={people} onClose={() => setOpenBoard(null)} /> : null}
      {chessOpen ? (
        <ChessGame
          onClose={() => {
            setChessOpen(false)
            setChessId(null)
          }}
          shared={
            room.connected && chessId && room.chess[chessId]
              ? {
                  game: room.chess[chessId].game,
                  side: room.chess[chessId].white === room.sessionId ? 'w' : room.chess[chessId].black === room.sessionId ? 'b' : null,
                  onMove: (move) => room.moveChess(chessId, move.from, move.to, move.promotion),
                }
              : undefined
          }
        />
      ) : null}
      {xoOpen ? (
        <XoGame
          onClose={() => {
            setXoOpen(false)
            setXoId(null)
          }}
          shared={
            room.connected && xoId && room.xo[xoId]
              ? {
                  game: room.xo[xoId].game,
                  side: room.xo[xoId].x === room.sessionId ? 'x' : room.xo[xoId].o === room.sessionId ? 'o' : null,
                  full: Boolean(room.xo[xoId].x && room.xo[xoId].o),
                  onMove: (index) => room.moveXo(xoId, index),
                  onReset: () => room.resetXo(xoId),
                }
              : undefined
          }
        />
      ) : null}
      {menuOpen ? (
        <OfficePause
          overview={overview}
          media={media}
          onResume={resume}
          onWalkInside={() => {
            setMenuOpen(false)
            setOverview(false)
          }}
          onOverview={() => {
            setMenuOpen(false)
            setOverview(true)
            if (document.pointerLockElement) document.exitPointerLock()
          }}
        />
      ) : null}
      {computer.open ? (
        <ComputerDesktop
          officeId="hq"
          boards={OFFICE_BOARDS.map((item) => ({ id: item.id, title: item.title }))}
          people={people}
          onLeave={computer.dismiss}
          onStand={() => {
            computer.dismiss()
            queueSit()
          }}
        />
      ) : null}
    </div>
  )
}
