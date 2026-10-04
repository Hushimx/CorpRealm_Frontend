import { create } from 'zustand'
import { api, isUnreachable, type Account } from './api'

type SessionState = {
  user: Account | null
  ready: boolean
  error: string
  load: () => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  saveProfile: (profile: Pick<Account, 'name' | 'face' | 'outfit' | 'pants'> & { avatarReady?: boolean }) => Promise<void>
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: false,
  error: '',
  load: async () => {
    try {
      const user = await api<Account>('/me')
      set({ user, ready: true, error: '' })
    } catch (error) {
      if (isUnreachable(error)) {
        set({ ready: true })
        return
      }
      set({ user: null, ready: true })
    }
  },
  register: async (email, password, name) => {
    const user = await api<Account>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) })
    set({ user, error: '' })
  },
  login: async (email, password) => {
    const user = await api<Account>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    set({ user, error: '' })
  },
  logout: async () => {
    await api('/auth/logout', { method: 'POST' })
    set({ user: null })
  },
  saveProfile: async (profile) => {
    const user = await api<Account>('/profile', { method: 'PATCH', body: JSON.stringify(profile) })
    set({ user })
  },
}))
