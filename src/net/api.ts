import { useLink } from './link'

export type Account = {
  id: string
  email: string
  name: string
  face: string
  outfit: string
  pants: string
  avatarReady: boolean
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function isUnreachable(error: unknown) {
  return error instanceof ApiError && (error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504)
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    })
  } catch {
    useLink.getState().markApiDown()
    throw new ApiError(0, 'The office server is unreachable.')
  }
  if (response.status === 502 || response.status === 503 || response.status === 504) {
    useLink.getState().markApiDown()
    throw new ApiError(response.status, 'The office server is unreachable.')
  }
  useLink.getState().markApiUp()
  if (!response.ok) {
    let message = response.statusText
    try {
      const body = (await response.json()) as { message?: string | string[] }
      if (Array.isArray(body.message)) message = body.message.join(' ')
      else if (body.message) message = body.message
    } catch {
      message = response.statusText
    }
    throw new ApiError(response.status, message)
  }
  return (await response.json()) as T
}
