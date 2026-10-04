import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  LIMITS,
  clampObject,
  clampRoom,
  createOffice,
  fitOffice,
  normalizeOffice,
  paint,
  roomsOverlap,
  type BuiltObject,
  type BuiltOffice,
  type BuiltRoom,
} from '../office/build'

const starter = createOffice('Annex')

type OfficeState = {
  offices: BuiltOffice[]
  activeId: string
  setActive: (id: string) => void
  create: () => void
  remove: (id: string) => void
  rename: (name: string) => void
  setSize: (width: number, depth: number) => void
  setPaint: (key: 'floor' | 'wall' | 'trim' | 'ceiling', color: string) => void
  addRoom: (room: BuiltRoom) => boolean
  patchRoom: (id: string, patch: Partial<BuiltRoom>) => boolean
  removeRoom: (id: string) => void
  addObject: (object: BuiltObject) => boolean
  patchObject: (id: string, patch: Partial<BuiltObject>) => void
  removeObject: (id: string) => void
}

function activeOffice(state: OfficeState) {
  return state.offices.find((office) => office.id === state.activeId) ?? null
}

function replace(state: OfficeState, office: BuiltOffice) {
  return { offices: state.offices.map((item) => (item.id === office.id ? office : item)) }
}

export const useOfficeStore = create<OfficeState>()(
  persist(
    (set, get) => ({
      offices: [starter],
      activeId: starter.id,
      setActive: (id) => set({ activeId: id }),
      create: () => {
        const office = createOffice(`Office ${get().offices.length + 1}`)
        set((state) => ({ offices: [...state.offices, office], activeId: office.id }))
      },
      remove: (id) =>
        set((state) => {
          const offices = state.offices.filter((office) => office.id !== id)
          return { offices, activeId: state.activeId === id ? (offices[0]?.id ?? '') : state.activeId }
        }),
      rename: (name) => {
        const state = get()
        const office = activeOffice(state)
        if (!office) return
        set(replace(state, { ...office, name: name.slice(0, 32) }))
      },
      setSize: (width, depth) => {
        const state = get()
        const office = activeOffice(state)
        if (!office) return
        const next = fitOffice({
          ...office,
          width: Math.min(36, Math.max(10, Math.round(width))),
          depth: Math.min(28, Math.max(8, Math.round(depth))),
        })
        set(replace(state, next))
      },
      setPaint: (key, color) => {
        const state = get()
        const office = activeOffice(state)
        if (!office) return
        set(replace(state, { ...office, [key]: paint(color, office[key]) }))
      },
      addRoom: (room) => {
        const state = get()
        const office = activeOffice(state)
        if (!office || office.rooms.length >= LIMITS.rooms) return false
        const next = clampRoom(office, room)
        if (roomsOverlap(office.rooms, next)) return false
        set(replace(state, { ...office, rooms: [...office.rooms, next] }))
        return true
      },
      patchRoom: (id, patch) => {
        const state = get()
        const office = activeOffice(state)
        if (!office) return false
        const current = office.rooms.find((room) => room.id === id)
        if (!current) return false
        const next = clampRoom(office, {
          ...current,
          ...patch,
          id: current.id,
          name: (patch.name ?? current.name).slice(0, 24),
        })
        if (roomsOverlap(office.rooms, next, id)) return false
        set(replace(state, { ...office, rooms: office.rooms.map((room) => (room.id === id ? next : room)) }))
        return true
      },
      removeRoom: (id) => {
        const state = get()
        const office = activeOffice(state)
        if (!office) return
        set(replace(state, { ...office, rooms: office.rooms.filter((room) => room.id !== id) }))
      },
      addObject: (object) => {
        const state = get()
        const office = activeOffice(state)
        if (!office || office.objects.length >= LIMITS.objects) return false
        set(replace(state, { ...office, objects: [...office.objects, clampObject(office, object)] }))
        return true
      },
      patchObject: (id, patch) => {
        const state = get()
        const office = activeOffice(state)
        if (!office) return
        set(
          replace(state, {
            ...office,
            objects: office.objects.map((object) => (object.id === id ? clampObject(office, { ...object, ...patch, id: object.id, kind: object.kind }) : object)),
          }),
        )
      },
      removeObject: (id) => {
        const state = get()
        const office = activeOffice(state)
        if (!office) return
        set(replace(state, { ...office, objects: office.objects.filter((object) => object.id !== id) }))
      },
    }),
    {
      name: 'corprealm-offices',
      version: 1,
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current
        const raw = persisted as { offices?: unknown; activeId?: unknown }
        const offices = Array.isArray(raw.offices) ? raw.offices.flatMap((office) => {
          const next = normalizeOffice(office)
          return next ? [next] : []
        }) : []
        if (!offices.length) return current
        const activeId = offices.some((office) => office.id === raw.activeId) ? String(raw.activeId) : offices[0].id
        return { ...current, offices, activeId }
      },
    },
  ),
)

export function useActiveOffice() {
  return useOfficeStore((state) => state.offices.find((office) => office.id === state.activeId) ?? null)
}
