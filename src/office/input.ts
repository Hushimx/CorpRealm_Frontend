const held = new Set<string>()
let jumpQueued = false
let sitQueued = false

export function holdKey(key: string, down: boolean) {
  if (down) held.add(key)
  else held.delete(key)
}

export function queueJump() {
  jumpQueued = true
}

export function takeJump() {
  const pending = jumpQueued
  jumpQueued = false
  return pending
}

export function queueSit() {
  sitQueued = true
}

export function takeSit() {
  const pending = sitQueued
  sitQueued = false
  return pending
}

export function isHeld(key: string) {
  return held.has(key)
}

export function clearHeld() {
  held.clear()
  jumpQueued = false
  sitQueued = false
}
