// The project used to be called Kinetic. This moves what the browser saved
// under the old keys to the new ones, once, so nobody loses their avatar or
// offices on the first visit after the rename. Safe to delete later.
for (const key of ['avatar', 'offices', 'tasks']) {
  try {
    const saved = localStorage.getItem(`kinetic-${key}`)
    if (saved === null) continue
    if (localStorage.getItem(`corprealm-${key}`) === null) localStorage.setItem(`corprealm-${key}`, saved)
    localStorage.removeItem(`kinetic-${key}`)
  } catch {
    // Storage is blocked. Nothing to carry over.
  }
}

export {}
