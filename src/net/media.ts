import { Room, RoomEvent, Track, type RemoteAudioTrack } from 'livekit-client'
import { playLevel, usePlaySettings } from '../store/play'
import { useCallback, useEffect, useRef, useState } from 'react'

type Heard = { userId: string; x: number; z: number }
type Ear = { current: { x: number; z: number; yaw: number } }

export type LiveTicket = { url: string; token: string }

export type VoicePerson = {
  id: string
  name: string
  speaking: boolean
  muted: boolean
  self: boolean
  near: boolean
}

export type AudioChoice = { id: string; label: string }

function choice(device: MediaDeviceInfo, fallback: string): AudioChoice {
  return { id: device.deviceId, label: device.label.trim() || fallback }
}

function quiet(room: Room) {
  room.remoteParticipants.forEach((participant) => {
    participant.audioTrackPublications.forEach((publication) => {
      const track = publication.track
      if (track && track.kind === Track.Kind.Audio) (track as RemoteAudioTrack).setVolume(0)
    })
  })
}

export type SharedPicture = {
  userId: string
  track: {
    attach(element: HTMLMediaElement): HTMLMediaElement
    detach(element: HTMLMediaElement): HTMLMediaElement
  }
}

export const VOICE_REACH = 7
const VOICE_FULL = 2.4

export function voiceVolume(distance: number) {
  if (distance <= VOICE_FULL) return 1
  if (distance >= VOICE_REACH) return 0
  const fade = 1 - (distance - VOICE_FULL) / (VOICE_REACH - VOICE_FULL)
  return fade * fade
}

function pictures(room: Room) {
  const cameras: SharedPicture[] = []
  const screens: SharedPicture[] = []
  const push = (userId: string, publication: { source: Track.Source; track?: SharedPicture['track'] & { kind: string } } | undefined) => {
    const track = publication?.track
    if (!track || track.kind !== Track.Kind.Video) return
    const picture = { userId, track }
    if (publication.source === Track.Source.ScreenShare) screens.push(picture)
    else if (publication.source === Track.Source.Camera && userId !== room.localParticipant.identity) cameras.push(picture)
  }
  room.remoteParticipants.forEach((participant) => {
    participant.trackPublications.forEach((publication) => push(participant.identity, publication))
  })
  const localScreen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)
  if (localScreen?.track && localScreen.track.kind === Track.Kind.Video) {
    screens.push({ userId: room.localParticipant.identity, track: localScreen.track })
  }
  return { cameras, screens }
}

export function useOfficeMedia(ticket: LiveTicket | null, active: boolean, ear: Ear, others: Heard[]) {
  const roomRef = useRef<Room | null>(null)
  const othersRef = useRef(others)
  othersRef.current = others
  const [mic, setMic] = useState(false)
  const [camera, setCamera] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [cameras, setCameras] = useState<SharedPicture[]>([])
  const [screens, setScreens] = useState<SharedPicture[]>([])
  const [localCamera, setLocalCamera] = useState<SharedPicture['track'] | null>(null)
  const [ready, setReady] = useState(false)
  const [hearing, setHearing] = useState(true)
  const [heard, setHeard] = useState<string[]>([])
  const [deaf, setDeaf] = useState(false)
  const [voices, setVoices] = useState<VoicePerson[]>([])
  const [mics, setMics] = useState<AudioChoice[]>([])
  const [heads, setHeads] = useState<AudioChoice[]>([])
  const [micId, setMicId] = useState('')
  const [headId, setHeadId] = useState('')
  const [error, setError] = useState('')
  const heardKey = useRef('')
  const voiceKey = useRef('')
  const micRef = useRef(false)
  const deafRef = useRef(false)
  const heldMic = useRef(false)
  const paintRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!ticket || !active) return
    const room = new Room({ adaptiveStream: true, dynacast: true })
    let closed = false
    roomRef.current = room

    const refresh = () => {
      if (closed) return
      const next = pictures(room)
      setCameras(next.cameras)
      setScreens(next.screens)
      const mine = room.localParticipant.getTrackPublication(Track.Source.Camera)
      setLocalCamera(mine?.track && mine.track.kind === Track.Kind.Video ? mine.track : null)
    }
    const mountAudio = (track: RemoteAudioTrack) => {
      if (track.attachedElements.length > 0) return
      const element = track.attach()
      element.autoplay = true
      element.setAttribute('playsinline', 'true')
      element.style.position = 'fixed'
      element.style.left = '0'
      element.style.bottom = '0'
      element.style.width = '1px'
      element.style.height = '1px'
      element.style.opacity = '0'
      element.style.pointerEvents = 'none'
      document.body.appendChild(element)
      void element.play().catch(() => undefined)
    }
    const releaseAudio = (track: RemoteAudioTrack) => {
      for (const element of track.detach()) element.remove()
    }
    const distanceTo = (userId: string) => {
      const body = othersRef.current.find((person) => person.userId === userId)
      if (!body) return Number.POSITIVE_INFINITY
      const here = ear.current
      return Math.hypot(body.x - here.x, body.z - here.z)
    }
    const describe = () => {
      if (closed) return
      const local = room.localParticipant
      const people: VoicePerson[] = [{
        id: local.identity,
        name: local.name || 'You',
        speaking: local.isSpeaking && micRef.current && !deafRef.current,
        muted: !micRef.current || deafRef.current,
        self: true,
        near: true,
      }]
      room.remoteParticipants.forEach((participant) => {
        const distance = distanceTo(participant.identity)
        const near = distance < VOICE_REACH
        const publication = participant.getTrackPublication(Track.Source.Microphone)
        const muted = !publication || publication.isMuted
        people.push({
          id: participant.identity,
          name: participant.name || 'Someone',
          speaking: participant.isSpeaking && !muted && near,
          muted,
          self: false,
          near,
        })
      })
      people.sort((a, b) => Number(b.self) - Number(a.self) || a.name.localeCompare(b.name))
      const key = people.map((person) => `${person.id}:${person.speaking ? 1 : 0}:${person.muted ? 1 : 0}:${person.near ? 1 : 0}:${person.name}`).join('|')
      if (key === voiceKey.current) return
      voiceKey.current = key
      setVoices(people)
    }
    const hear = () => {
      const names: string[] = []
      room.remoteParticipants.forEach((participant) => {
        const distance = distanceTo(participant.identity)
        const volume = deafRef.current ? 0 : voiceVolume(distance) * playLevel()
        let speaking = false
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.source !== Track.Source.Microphone && publication.source !== Track.Source.ScreenShareAudio) return
          if (!publication.isSubscribed) void publication.setSubscribed(true)
          const track = publication.track
          if (!track || track.kind !== Track.Kind.Audio) return
          const audio = track as RemoteAudioTrack
          mountAudio(audio)
          audio.setVolume(volume)
          if (publication.source === Track.Source.Microphone && !publication.isMuted && volume > 0.02) speaking = true
        })
        if (speaking) names.push(participant.name || 'Someone')
        participant.videoTrackPublications.forEach((publication) => {
          if (publication.source !== Track.Source.Camera) return
          const near = distance < VOICE_REACH
          if (publication.isSubscribed !== near) void publication.setSubscribed(near)
        })
      })
      names.sort()
      const key = names.join('\n')
      if (key !== heardKey.current) {
        heardKey.current = key
        setHeard(names)
      }
      describe()
    }

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) mountAudio(track as RemoteAudioTrack)
      refresh()
      hear()
    })
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) releaseAudio(track as RemoteAudioTrack)
      refresh()
      hear()
    })
    paintRef.current = describe
    room.on(RoomEvent.ActiveSpeakersChanged, describe)
    room.on(RoomEvent.ParticipantConnected, describe)
    room.on(RoomEvent.ParticipantDisconnected, () => {
      refresh()
      describe()
    })
    room.on(RoomEvent.TrackMuted, describe)
    room.on(RoomEvent.TrackUnmuted, describe)
    room.on(RoomEvent.LocalTrackPublished, () => {
      refresh()
      describe()
    })
    room.on(RoomEvent.LocalTrackUnpublished, () => {
      refresh()
      describe()
    })
    room.on(RoomEvent.AudioPlaybackStatusChanged, (enabled: boolean) => {
      if (!closed) setHearing(enabled)
    })
    room.on(RoomEvent.Disconnected, () => {
      setReady(false)
      setHearing(true)
      setHeard([])
      setDeaf(false)
      setVoices([])
      heardKey.current = ''
      voiceKey.current = ''
      micRef.current = false
      deafRef.current = false
      heldMic.current = false
      setMic(false)
      setCamera(false)
      setSharing(false)
    })

    const timer = window.setInterval(hear, 100)
    void room.connect(ticket.url, ticket.token).then(async () => {
      if (closed) {
        void room.disconnect()
        return
      }
      await room.startAudio().catch(() => undefined)
      const saved = usePlaySettings.getState()
      if (saved.micId) await room.switchActiveDevice('audioinput', saved.micId).catch(() => undefined)
      if (saved.headId) await room.switchActiveDevice('audiooutput', saved.headId).catch(() => undefined)
      setHearing(room.canPlaybackAudio)
      setReady(true)
      setError('')
      refresh()
      hear()
    }).catch(() => {
      if (!closed) setError('Could not open the voice room.')
    })

    return () => {
      closed = true
      window.clearInterval(timer)
      roomRef.current = null
      setReady(false)
      setHearing(true)
      setHeard([])
      setDeaf(false)
      setVoices([])
      setMics([])
      setHeads([])
      heardKey.current = ''
      voiceKey.current = ''
      micRef.current = false
      deafRef.current = false
      heldMic.current = false
      paintRef.current = () => {}
      setMic(false)
      setCamera(false)
      setSharing(false)
      setCameras([])
      setScreens([])
      setLocalCamera(null)
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => {
          const track = publication.track
          if (track && track.kind === Track.Kind.Audio) releaseAudio(track as RemoteAudioTrack)
        })
      })
      void room.disconnect()
    }
  }, [active, ticket])

  useEffect(() => {
    micRef.current = mic
    deafRef.current = deaf
    paintRef.current()
  }, [deaf, mic])

  const toggleMic = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !mic
    if (next && deafRef.current) {
      deafRef.current = false
      setDeaf(false)
    }
    try {
      await room.localParticipant.setMicrophoneEnabled(next)
      await room.startAudio().catch(() => undefined)
      micRef.current = next
      setHearing(room.canPlaybackAudio)
      setMic(next)
      setError('')
    } catch {
      micRef.current = false
      setMic(false)
      setError('The microphone was blocked.')
    }
  }, [mic])

  const toggleDeaf = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !deafRef.current
    deafRef.current = next
    setDeaf(next)
    if (next) {
      quiet(room)
      heldMic.current = micRef.current
      if (micRef.current) {
        micRef.current = false
        setMic(false)
        await room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined)
      }
      return
    }
    await room.startAudio().catch(() => undefined)
    setHearing(room.canPlaybackAudio)
    if (!heldMic.current) return
    heldMic.current = false
    try {
      await room.localParticipant.setMicrophoneEnabled(true)
      micRef.current = true
      setMic(true)
      setError('')
    } catch {
      micRef.current = false
      setMic(false)
      setError('The microphone was blocked.')
    }
  }, [])

  const refreshDevices = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      const inputs = await Room.getLocalDevices('audioinput', true)
      const outputs = await Room.getLocalDevices('audiooutput').catch(() => [] as MediaDeviceInfo[])
      setMics(inputs.filter((device) => device.deviceId).map((device, index) => choice(device, `Microphone ${index + 1}`)))
      setHeads(outputs.filter((device) => device.deviceId).map((device, index) => choice(device, `Headset ${index + 1}`)))
      setMicId(room.getActiveDevice('audioinput') ?? '')
      setHeadId(room.getActiveDevice('audiooutput') ?? '')
      setError('')
    } catch {
      setError('Allow the microphone to choose a device.')
    }
  }, [])

  const chooseMic = useCallback(async (id: string) => {
    const room = roomRef.current
    if (!room) return
    try {
      await room.switchActiveDevice('audioinput', id)
      setMicId(id)
      setError('')
    } catch {
      setError('That microphone could not be used.')
    }
  }, [])

  const chooseHead = useCallback(async (id: string) => {
    const room = roomRef.current
    if (!room) return
    try {
      await room.switchActiveDevice('audiooutput', id)
      setHeadId(id)
      setError('')
    } catch {
      setError('This browser cannot switch headsets.')
    }
  }, [])

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !camera
    try {
      await room.localParticipant.setCameraEnabled(next)
      setCamera(next)
      setError('')
    } catch {
      setCamera(false)
      setError('The camera was blocked.')
    }
  }, [camera])

  const toggleShare = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    const next = !sharing
    try {
      if (next) {
        try {
          await room.localParticipant.setScreenShareEnabled(true, { audio: true })
        } catch {
          await room.localParticipant.setScreenShareEnabled(true)
        }
      } else {
        await room.localParticipant.setScreenShareEnabled(false)
      }
      setSharing(next)
      setError('')
    } catch {
      setSharing(false)
      setError('Screen share was cancelled.')
    }
  }, [sharing])

  const unlock = useCallback(async () => {
    const room = roomRef.current
    if (!room) return
    try {
      await room.startAudio()
      setHearing(room.canPlaybackAudio)
      setError('')
    } catch {
      setHearing(false)
    }
  }, [])

  return {
    mic,
    camera,
    sharing,
    cameras,
    screens,
    localCamera,
    ready,
    hearing,
    heard,
    deaf,
    voices,
    mics,
    heads,
    micId,
    headId,
    error,
    unlock,
    toggleMic,
    toggleDeaf,
    toggleCamera,
    toggleShare,
    refreshDevices,
    chooseMic,
    chooseHead,
  }
}

export type OfficeMedia = ReturnType<typeof useOfficeMedia>
