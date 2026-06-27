'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getSessions, clearSessions, type SessionRecord } from '@/lib/storage'

type ScoreKey = 'vocabulary' | 'grammar' | 'fluency' | 'pronunciation' | 'confidence'

const SCORE_LABELS: Record<ScoreKey, string> = {
  vocabulary: 'Vocabulary',
  grammar: 'Grammar',
  fluency: 'Fluency',
  pronunciation: 'Pronunciation',
  confidence: 'Confidence',
}

const SCORE_KEYS: ScoreKey[] = ['vocabulary', 'grammar', 'fluency', 'pronunciation', 'confidence']

const TOOL_LABEL: Record<string, string> = { voice: 'Voice', camera: 'Camera', screen: 'Screen' }
const TOOL_COLOR: Record<string, string> = {
  voice: 'text-violet-400 bg-violet-950/50 border-violet-900/50',
  camera: 'text-blue-400 bg-blue-950/50 border-blue-900/50',
  screen: 'text-emerald-400 bg-emerald-950/50 border-emerald-900/50',
}

function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return sec > 0 ? `${m}m ${sec}s` : `${m}m`
  return `${s}s`
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function computeStreak(sessions: SessionRecord[]): number {
  if (sessions.length === 0) return 0
  const days = new Set(sessions.map((s) => new Date(s.timestamp).toDateString()))
  const sorted = Array.from(days).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0
  let streak = 1
  let cur = new Date(sorted[0])
  for (let i = 1; i < sorted.length; i++) {
    const expected = new Date(cur.getTime() - 86400000).toDateString()
    if (sorted[i] === expected) {
      streak++
      cur = new Date(sorted[i])
    } else {
      break
    }
  }
  return streak
}

function avg(vals: (number | null | undefined)[]): number | null {
  const nums = vals.filter((v): v is number => v != null)
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null
}

function scoreColor(v: number): string {
  return v >= 8 ? 'bg-green-500' : v >= 5 ? 'bg-amber-500' : 'bg-red-500'
}

function scoreBadgeColor(v: number): string {
  return v >= 8
    ? 'text-green-400 bg-green-950/40'
    : v >= 5
    ? 'text-amber-400 bg-amber-950/40'
    : 'text-red-400 bg-red-950/40'
}

export default function ProgressPage() {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setSessions(getSessions())
  }, [])

  if (!mounted) return null

  if (sessions.length === 0) {
    return (
      <div className="max-w-2xl space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-1">Progress</h1>
          <p className="text-zinc-400 text-sm">Your practice history will appear here after your first recording.</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-500 text-sm mb-5">No sessions recorded yet.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/voice" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
              Start with Voice
            </Link>
            <Link href="/camera" className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors">
              Try Camera
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const totalSeconds = sessions.reduce((s, r) => s + r.durationSeconds, 0)
  const days = new Set(sessions.map((s) => new Date(s.timestamp).toDateString()))
  const streak = computeStreak(sessions)

  const withScores = sessions.filter((s) => s.scores !== null)
  const recent5 = withScores.slice(-5)
  const prev5 = withScores.slice(-10, -5)

  const handleClear = () => {
    if (confirm('Delete all session history? This cannot be undone.')) {
      clearSessions()
      setSessions([])
    }
  }

  const recent = [...sessions].reverse().slice(0, 30)

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Progress</h1>
          <p className="text-zinc-400 text-sm">Your English practice history, tracked automatically.</p>
        </div>
        <button onClick={handleClear} className="text-xs text-zinc-600 hover:text-red-400 transition-colors mt-1">
          Clear data
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Time', value: fmtDuration(totalSeconds) },
          { label: 'Sessions', value: String(sessions.length) },
          { label: 'Days Practiced', value: String(days.size) },
          { label: 'Day Streak', value: `${streak} day${streak !== 1 ? 's' : ''}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Score trends */}
      {withScores.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Average Scores</span>
            {prev5.length > 0 && (
              <span className="text-xs text-zinc-600">vs previous {prev5.length} session{prev5.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          <div className="space-y-4">
            {SCORE_KEYS.map((key) => {
              const rAvg = avg(recent5.map((s) => s.scores?.[key]))
              const pAvg = avg(prev5.map((s) => s.scores?.[key]))
              if (rAvg === null) return null
              const diff = pAvg !== null ? rAvg - pAvg : null
              const trendUp = diff !== null && diff > 0.2
              const trendDown = diff !== null && diff < -0.2
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-zinc-300">{SCORE_LABELS[key]}</span>
                    <div className="flex items-center gap-2">
                      {diff !== null && (trendUp || trendDown) && (
                        <span className={`text-xs font-mono ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
                          {trendUp ? '+' : ''}{diff.toFixed(1)}
                        </span>
                      )}
                      <span className="text-sm font-semibold tabular-nums">
                        {rAvg.toFixed(1)}<span className="text-zinc-600 text-xs">/10</span>
                      </span>
                    </div>
                  </div>
                  <div className="bg-zinc-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${scoreColor(rAvg)}`}
                      style={{ width: `${rAvg * 10}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent sessions */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <span className="text-xs text-zinc-500 uppercase tracking-widest">
          Recent Sessions {sessions.length > 30 ? `(last 30 of ${sessions.length})` : ''}
        </span>
        <div className="space-y-0">
          {recent.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-3 py-2.5 border-b border-zinc-800/60 last:border-0 flex-wrap"
            >
              <span className="text-xs text-zinc-500 w-14 shrink-0">{fmtDate(s.timestamp)}</span>
              <span className={`text-xs px-2 py-0.5 rounded border font-medium shrink-0 ${TOOL_COLOR[s.tool]}`}>
                {TOOL_LABEL[s.tool]}
              </span>
              <span className="text-xs text-zinc-400 font-mono shrink-0">{fmtDuration(s.durationSeconds)}</span>
              {s.scores ? (
                <div className="flex gap-1.5 flex-wrap ml-auto">
                  {SCORE_KEYS.map((key) => {
                    const val = s.scores![key]
                    if (val === null) return null
                    return (
                      <span
                        key={key}
                        title={SCORE_LABELS[key]}
                        className={`text-xs font-mono px-1.5 py-0.5 rounded ${scoreBadgeColor(val)}`}
                      >
                        {SCORE_LABELS[key][0]}{val}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <span className="text-xs text-zinc-700 ml-auto">no analysis run</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
