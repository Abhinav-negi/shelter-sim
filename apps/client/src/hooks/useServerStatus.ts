import { useEffect, useState } from 'react'
import { getHealth } from '@/api'

export type ServerStatus = 'checking' | 'online' | 'offline'

/** Polls GET /api/health every 10s. */
export function useServerStatus(intervalMs = 10_000): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>('checking')

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        await getHealth()
        if (!cancelled) setStatus('online')
      } catch {
        if (!cancelled) setStatus('offline')
      }
    }
    check()
    const id = setInterval(check, intervalMs)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [intervalMs])

  return status
}
