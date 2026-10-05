import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type PlaySettings = {
  fov: number
  sensitivity: number
  voice: number
  output: number
  micId: string
  headId: string
  setFov: (fov: number) => void
  setSensitivity: (sensitivity: number) => void
  setVoice: (voice: number) => void
  setOutput: (output: number) => void
  setMicId: (micId: string) => void
  setHeadId: (headId: string) => void
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export const usePlaySettings = create<PlaySettings>()(
  persist(
    (set) => ({
      fov: 52,
      sensitivity: 1,
      voice: 1,
      output: 1,
      micId: '',
      headId: '',
      setFov: (fov) => set({ fov: clamp(fov, 40, 90) }),
      setSensitivity: (sensitivity) => set({ sensitivity: clamp(sensitivity, 0.25, 2.5) }),
      setVoice: (voice) => set({ voice: clamp(voice, 0, 1) }),
      setOutput: (output) => set({ output: clamp(output, 0, 1) }),
      setMicId: (micId) => set({ micId }),
      setHeadId: (headId) => set({ headId }),
    }),
    { name: 'corprealm-play' },
  ),
)

export function playLevel() {
  const { voice, output } = usePlaySettings.getState()
  return clamp(voice, 0, 1) * clamp(output, 0, 1)
}
