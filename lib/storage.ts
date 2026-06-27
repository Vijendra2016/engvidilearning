export type Tool = 'voice' | 'camera' | 'screen'

export interface SessionRecord {
  id: string
  timestamp: number
  tool: Tool
  durationSeconds: number
  wordCount: number
  wpm: number | null
  scores: {
    vocabulary: number | null
    grammar: number | null
    fluency: number | null
    pronunciation: number | null
    confidence: number | null
  } | null
  fillerCount: number
}

const KEY = 'english-lab-sessions'

export function getSessions(): SessionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SessionRecord[]
  } catch {
    return []
  }
}

export function saveSession(s: Omit<SessionRecord, 'id'>): string {
  const id = crypto.randomUUID()
  const sessions = getSessions()
  sessions.push({ ...s, id })
  localStorage.setItem(KEY, JSON.stringify(sessions))
  return id
}

export function updateSession(
  id: string,
  patch: Partial<Pick<SessionRecord, 'wordCount' | 'wpm' | 'scores' | 'fillerCount'>>
): void {
  const sessions = getSessions()
  const idx = sessions.findIndex((s) => s.id === id)
  if (idx === -1) return
  sessions[idx] = { ...sessions[idx], ...patch }
  localStorage.setItem(KEY, JSON.stringify(sessions))
}

export function clearSessions(): void {
  localStorage.removeItem(KEY)
}
