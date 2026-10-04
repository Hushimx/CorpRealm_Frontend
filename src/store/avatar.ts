import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { randomSkin, type AvatarParts, type PoseId, type SkinId } from '../avatar/parts'

interface AvatarState extends AvatarParts {
  name: string
  pose: PoseId
  setName: (name: string) => void
  setFace: (face: SkinId) => void
  setOutfit: (outfit: SkinId) => void
  setPants: (pants: SkinId) => void
  setPose: (pose: PoseId) => void
  randomize: () => void
}

export const useAvatarStore = create<AvatarState>()(
  persist(
    (set) => ({
      name: '',
      face: 'a',
      outfit: 'c',
      pants: 'a',
      pose: 'idle',
      setName: (name) => set({ name }),
      setFace: (face) => set({ face }),
      setOutfit: (outfit) => set({ outfit }),
      setPants: (pants) => set({ pants }),
      setPose: (pose) => set({ pose }),
      randomize: () =>
        set({
          face: randomSkin(),
          outfit: randomSkin(),
          pants: randomSkin(),
        }),
    }),
    { name: 'corprealm-avatar' },
  ),
)
