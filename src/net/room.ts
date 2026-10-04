import { Client, type Room, type SeatReservation } from 'colyseus.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Game } from '../chess/rules'
import type { XoMatch } from '@corprealm/xo'
import type { Motion, Presence } from '../components/scene/OfficeWorld'
import type { RemoteBody } from '../components/scene/RemotePeople'
import { queueSit } from '../office/input'
import { mergeBoards, subscribeBoards, type TaskBoardData } from '../store/tasks'
import { api } from './api'
import { useLink } from './link'
import type { LiveTicket } from './media'
import { useSession } from './session'

export type SharedTable = {
  game: Game
  white: string | null
  black: string | null
}

export type SharedXo = {
  game: XoMatch
  x: string | null
  o: string | null
}

type Rejected = { op?: string; reason?: string }

export type RoomPlace = { dx: number; dz: number; yaw: number }

const worldUrl = import.meta.env.VITE_WORLD_URL ?? 'ws://localhost:2567'

export function presenceLine(state: { signedIn: boolean; active: boolean; connected: boolean; notice: '' | 'replaced' | 'failed'; names: string[] }) {
  if (state.notice === 'replaced') return 'This account is already inside another window. Sign that window in as someone else.'
  if (!state.signedIn) return 'Sign in, then walk inside. Each person needs their own account.'
  if (!state.active) return 'Walk inside to join the live office.'
  if (state.notice === 'failed') return 'The live office did not connect.'
  if (!state.connected) return 'Connecting to the live office…'
  if (state.names.length === 0) return 'You are the only one inside.'
  return `Here with ${state.names.join(', ')}`
}

export function useOfficeRoom(officeId: string | null, active: boolean) {
  const user = useSession((state) => state.user)
  const attempt = useLink((state) => state.attempt)
  const roomRef = useRef<Room | null>(null)
  const poseRef = useRef<Motion | null>(null)
  const claimRef = useRef<{ kind: 'chess' | 'xo'; tableId: string } | null>(null)
  const armed = useRef(false)
  const [others, setOthers] = useState<RemoteBody[]>([])
  const [sessionId, setSessionId] = useState('')
  const [chess, setChess] = useState<Record<string, SharedTable>>({})
  const [xo, setXo] = useState<Record<string, SharedXo>>({})
  const [connected, setConnected] = useState(false)
  const [place, setPlace] = useState<RoomPlace | null>(null)
  const [livekit, setLivekit] = useState<LiveTicket | null>(null)
  const [notice, setNotice] = useState<'' | 'replaced' | 'failed'>('')
  const [joinedAt, setJoinedAt] = useState(0)

  useEffect(() => {
    if (!user || !officeId || !active) return
    let closed = false
    let room: Room | null = null
    let poseTimer = 0
    armed.current = false
    setPlace(null)
    setLivekit(null)
    setNotice('')

    async function join() {
      const ticket = await api<{ reservation: SeatReservation; livekit: LiveTicket | null }>(`/offices/${officeId}/join`, { method: 'POST' })
      if (!closed) setLivekit(ticket.livekit)
      if (closed) return
      room = await new Client(worldUrl).consumeSeatReservation(ticket.reservation)
      if (closed) {
        await room.leave()
        return
      }
      roomRef.current = room
      setSessionId(room.sessionId)
      setConnected(true)
      setJoinedAt(Date.now())
      useLink.getState().markWorldUp()
      if (useLink.getState().retrying) useLink.getState().endRetry('')
      room.onLeave((code) => {
        if (closed) return
        setConnected(false)
        setOthers([])
        if (code === 4001) {
          setNotice('replaced')
          useLink.getState().markReplaced()
          return
        }
        setNotice('failed')
        useLink.getState().markWorldDown()
      })
      let boardsSeen = ''
      let chessSeen = ''
      let xoSeen = ''
      const publish = () => {
        if (closed || roomRef.current !== room) return
        const state = room?.state as
          | {
              layoutVersion?: number
              boardsJson?: string
              chessJson?: string
              xoJson?: string
              players?: { forEach: (fn: (player: RemoteBody, sessionId: string) => void) => void }
            }
          | undefined
        if (!state || !room) return
        const people: RemoteBody[] = []
        state.players?.forEach((player, id) => {
          if (id === room?.sessionId) return
          people.push({
            sessionId: id,
            userId: player.userId,
            name: player.name,
            face: player.face,
            outfit: player.outfit,
            pants: player.pants,
            x: player.x,
            y: player.y,
            z: player.z,
            yaw: player.yaw,
            gait: player.gait,
            sitting: player.sitting,
            joinedAt: Number(player.joinedAt) || 0,
          })
        })
        setOthers(people)
        if ((state.layoutVersion ?? 0) > 0 && state.boardsJson && state.boardsJson !== boardsSeen) {
          boardsSeen = state.boardsJson
          mergeBoards(JSON.parse(state.boardsJson) as Record<string, TaskBoardData>)
        }
        if (state.chessJson && state.chessJson !== chessSeen) {
          chessSeen = state.chessJson
          const tables = JSON.parse(state.chessJson) as Record<string, SharedTable>
          setChess(tables)
          const claim = claimRef.current
          if (claim?.kind === 'chess') {
            const held = tables[claim.tableId]
            if (held && (held.white === room.sessionId || held.black === room.sessionId)) claimRef.current = null
          }
        }
        if (state.xoJson && state.xoJson !== xoSeen) {
          xoSeen = state.xoJson
          const tables = JSON.parse(state.xoJson) as Record<string, SharedXo>
          setXo(tables)
          const claim = claimRef.current
          if (claim?.kind === 'xo') {
            const held = tables[claim.tableId]
            if (held && (held.x === room.sessionId || held.o === room.sessionId)) claimRef.current = null
          }
        }
      }
      room.onStateChange(publish)
      room.onMessage('welcome', (message: RoomPlace) => {
        if (Number.isFinite(message?.dx) && Number.isFinite(message?.dz) && Number.isFinite(message?.yaw)) setPlace(message)
      })
      room.onMessage('replaced', () => {
        setNotice('replaced')
        useLink.getState().markReplaced()
      })
      room.onMessage('rejected', (message: Rejected) => {
        if (message.op === 'sit') queueSit()
        if (message.reason !== 'taken' || !claimRef.current) return
        const claim = claimRef.current
        claimRef.current = null
        if (message.op === 'chess' && claim.kind === 'chess') room?.send('chess', { op: 'sit', tableId: claim.tableId, color: 'b' })
        if (message.op === 'xo' && claim.kind === 'xo') room?.send('xo', { op: 'sit', tableId: claim.tableId, color: 'o' })
      })
      publish()
      poseTimer = window.setInterval(() => {
        const pose = poseRef.current
        if (!armed.current || !pose || pose.sitting) return
        room?.send('pose', { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw, gait: pose.gait, roomId: pose.roomId })
      }, 50)
    }

    void join().catch(() => {
      if (closed) return
      setConnected(false)
      setNotice('failed')
      useLink.getState().markWorldDown()
      if (useLink.getState().retrying) useLink.getState().endRetry('Still unreachable.')
    })

    const stopBoards = subscribeBoards((event) => {
      const { boardId, ...op } = event
      roomRef.current?.send('board', { boardId, ...op })
    })

    return () => {
      closed = true
      stopBoards()
      window.clearInterval(poseTimer)
      setConnected(false)
      setJoinedAt(0)
      setOthers([])
      setLivekit(null)
      setSessionId('')
      const current = roomRef.current
      roomRef.current = null
      void current?.leave()
    }
  }, [active, attempt, officeId, user?.id])

  useEffect(() => {
    return () => {
      useLink.getState().clearWorld()
    }
  }, [active, officeId, user?.id])

  const standAt = useCallback((pose: Presence) => {
    poseRef.current = { x: pose.x, z: pose.z, y: 0, yaw: pose.yaw, gait: 'idle', roomId: pose.roomId, sitting: pose.sitting }
    armed.current = true
  }, [])

  const trackMotion = useCallback((motion: Motion) => {
    poseRef.current = motion
  }, [])

  const seatRef = useRef({ sitting: false, seatId: '' })
  const notePose = useCallback((pose: Presence) => {
    const previous = seatRef.current
    seatRef.current = { sitting: pose.sitting, seatId: pose.seatId }
    if (!connected) return
    if (previous.sitting === pose.sitting && previous.seatId === pose.seatId) return
    const room = roomRef.current
    if (!room) return
    if (pose.sitting && pose.seatId) room.send('sit', { seatId: pose.seatId })
    else room.send('stand')
  }, [connected])

  function claimChess(tableId: string) {
    claimRef.current = { kind: 'chess', tableId }
    roomRef.current?.send('chess', { op: 'sit', tableId, color: 'w' })
  }

  function moveChess(tableId: string, from: number, to: number, promotion?: string) {
    roomRef.current?.send('chess', { op: 'move', tableId, from, to, promotion })
  }

  function claimXo(tableId: string) {
    claimRef.current = { kind: 'xo', tableId }
    roomRef.current?.send('xo', { op: 'sit', tableId, color: 'x' })
  }

  function moveXo(tableId: string, index: number) {
    roomRef.current?.send('xo', { op: 'move', tableId, index })
  }

  function resetXo(tableId: string) {
    roomRef.current?.send('xo', { op: 'reset', tableId })
  }

  return { others, sessionId, chess, xo, connected, joinedAt, place, livekit, notice, notePose, standAt, trackMotion, claimChess, moveChess, claimXo, moveXo, resetXo }
}
