import { useEffect, useState } from 'react'
import { api } from './api'

export type OfficePerson = { id: string; name: string; face: string }

export function useOfficePeople(officeId: string | null) {
  const [people, setPeople] = useState<OfficePerson[]>([])
  useEffect(() => {
    if (!officeId) {
      setPeople([])
      return
    }
    let closed = false
    void api<OfficePerson[]>(`/offices/${officeId}/people`)
      .then((rows) => {
        if (!closed) setPeople(rows)
      })
      .catch(() => {
        if (!closed) setPeople([])
      })
    return () => {
      closed = true
    }
  }, [officeId])
  return people
}
