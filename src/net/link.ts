import { create } from 'zustand'

type LinkState = {
  api: 'up' | 'down'
  world: 'idle' | 'up' | 'down'
  replaced: boolean
  retrying: boolean
  attempt: number
  note: string
  markApiDown: () => void
  markApiUp: () => void
  markWorldDown: () => void
  markWorldUp: () => void
  markReplaced: () => void
  clearWorld: () => void
  beginRetry: () => void
  endRetry: (note: string) => void
  bump: () => void
}

export const useLink = create<LinkState>((set) => ({
  api: 'up',
  world: 'idle',
  replaced: false,
  retrying: false,
  attempt: 0,
  note: '',
  markApiDown: () => set({ api: 'down' }),
  markApiUp: () => set({ api: 'up' }),
  markWorldDown: () => set({ world: 'down', replaced: false }),
  markWorldUp: () => set({ world: 'up', replaced: false, note: '' }),
  markReplaced: () => set({ world: 'down', replaced: true }),
  clearWorld: () => set({ world: 'idle', replaced: false, retrying: false }),
  beginRetry: () => set({ retrying: true, note: '' }),
  endRetry: (note) => set({ retrying: false, note }),
  bump: () => set((state) => ({ attempt: state.attempt + 1 })),
}))
