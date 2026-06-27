'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { analyzeTranscript, type AnalysisResult } from '@/lib/analyze'
import { saveSession, updateSession } from '@/lib/storage'

type Segment = { text: string; confidence: number; timestamp: number }
type GrammarStatus = 'idle' | 'checking' | 'done'
type AnalyzeStatus = 'idle' | 'done'

interface LTMatch {
  message: string
  offset: number
  length: number
  replacements: { value: string }[]
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5]

export default function ScreenPage() {
  const [capturing, setCapturing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [segments, setSegments] = useState<Segment[]>([])
  const [interim, setInterim] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [grammarStatus, setGrammarStatus] = useState<GrammarStatus>('idle')
  const [grammarMatches, setGrammarMatches] = useState<LTMatch[]>([])
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>('idle')
  const [analyzeResult, setAnalyzeResult] = useState<AnalysisResult | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognizingRef = useRef(false)
  const interimRef = useRef('')
  const elapsedRef = useRef(0)
  const transcriptScrollRef = useRef<HTMLDivElement>(null)
  const savedSessionIdRef = useRef<string | null>(null)
  const prevRecordingRef = useRef(false)

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  useEffect(() => {
    const el = transcriptScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [segments, interim])

  const fullText = segments.map((s) => s.text).join('')
  const fullTextWithTimestamps = segments.map((s) => {
    const m = Math.floor(s.timestamp / 60)
    const ss = String(s.timestamp % 60).padStart(2, '0')
    return `[${m}:${ss}] ${s.text.trim()}`
  }).join('\n')

  const applySpeed = (speed: number) => {
    setPlaybackSpeed(speed)
    if (playbackRef.current) playbackRef.current.playbackRate = speed
  }

  const stopAll = useCallback((stopRecorder = true) => {
    if (stopRecorder && recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recognizingRef.current = false
    recognitionRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    interimRef.current = ''
    setCapturing(false)
    setRecording(false)
    setInterim('')
  }, [])

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      stream.getTracks().forEach((track) => { track.onended = () => stopAll(true) })
      setCapturing(true)
      setVideoUrl(null)
      setSegments([])
      setGrammarStatus('idle')
      setGrammarMatches([])
      setAnalyzeStatus('idle')
      setAnalyzeResult(null)
    } catch (_) {
      // User cancelled the share dialog
    }
  }

  const startRecording = () => {
    if (!streamRef.current) return
    const recorder = new MediaRecorder(streamRef.current)
    chunksRef.current = []
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setVideoUrl(URL.createObjectURL(blob))
    }
    recorder.start()
    recorderRef.current = recorder

    savedSessionIdRef.current = null
    elapsedRef.current = 0
    setElapsed(0)
    setSegments([])
    setGrammarStatus('idle')
    setGrammarMatches([])
    setAnalyzeStatus('idle')
    setAnalyzeResult(null)
    interimRef.current = ''
    setInterim('')

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) {
      recognizingRef.current = true

      const startRecognition = () => {
        if (!recognizingRef.current) return
        const recognition = new SR()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.onresult = (e) => {
          let inter = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const r = e.results[i]
            if (r.isFinal) {
              const conf = r[0].confidence > 0 ? r[0].confidence : 0.9
              const text = r[0].transcript.trim()
              if (text) setSegments((prev) => [...prev, { text: text + ' ', confidence: conf, timestamp: elapsedRef.current }])
            } else {
              inter += r[0].transcript
            }
          }
          interimRef.current = inter
          setInterim(inter)
        }
        recognition.onend = () => {
          if (recognizingRef.current) {
            const leftover = interimRef.current.trim()
            if (leftover) setSegments((prev) => [...prev, { text: leftover + ' ', confidence: 0.8, timestamp: elapsedRef.current }])
            interimRef.current = ''
            setInterim('')
            startRecognition()
          } else {
            interimRef.current = ''
            setInterim('')
          }
        }
        recognition.onerror = () => { if (recognizingRef.current) setTimeout(startRecognition, 300) }
        try { recognition.start(); recognitionRef.current = recognition } catch (_) {}
      }

      startRecognition()
    }

    timerRef.current = setInterval(() => { elapsedRef.current += 1; setElapsed((s) => s + 1) }, 1000)
    setRecording(true)
    setVideoUrl(null)
  }

  const stopRecording = () => {
    recognizingRef.current = false
    const leftover = interimRef.current.trim()
    if (leftover) setSegments((prev) => [...prev, { text: leftover + ' ', confidence: 0.8, timestamp: elapsedRef.current }])
    interimRef.current = ''
    recorderRef.current?.stop()
    recognitionRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setInterim('')
  }

  const checkGrammar = async () => {
    const text = fullText.trim()
    if (!text) return
    setGrammarStatus('checking')
    try {
      const res = await fetch('https://api.languagetool.org/v2/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ language: 'en-US', text }).toString(),
      })
      const data: { matches: LTMatch[] } = await res.json()
      setGrammarMatches(data.matches || [])
      setGrammarStatus('done')
    } catch (_) {
      setGrammarStatus('idle')
      alert('Grammar check failed. Please check your internet connection.')
    }
  }

  const checkFluency = () => {
    const text = fullText.trim()
    if (text.split(/\s+/).filter(Boolean).length < 5) {
      alert('Transcript is too short. Record at least a few sentences first.')
      return
    }
    const result = analyzeTranscript(text, elapsed, {
      segments,
      grammarMatches: grammarStatus === 'done' ? grammarMatches : undefined,
    })
    setAnalyzeResult(result)
    setAnalyzeStatus('done')
    if (savedSessionIdRef.current) {
      const wordCount = text.split(/\s+/).filter(Boolean).length
      const fillerCount = result.fillerWords.reduce((s, f) => s + f.count, 0)
      updateSession(savedSessionIdRef.current, { wordCount, wpm: result.wpm, scores: result.scores, fillerCount })
      savedSessionIdRef.current = null
    }
  }

  useEffect(() => {
    if (!recording && fullText.trim().split(/\s+/).filter(Boolean).length >= 5 && grammarStatus === 'idle') {
      checkGrammar()
    }
    if (!recording && prevRecordingRef.current && elapsedRef.current >= 3) {
      savedSessionIdRef.current = saveSession({
        timestamp: Date.now(),
        tool: 'screen',
        durationSeconds: elapsedRef.current,
        wordCount: 0,
        wpm: null,
        scores: null,
        fillerCount: 0,
      })
    }
    prevRecordingRef.current = recording
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording])

  const segmentColor = (conf: number) =>
    conf >= 0.8 ? 'text-zinc-100' : conf >= 0.6 ? 'text-yellow-300' : 'text-red-400'

  const getTimestampForOffset = (offset: number): number => {
    let pos = 0
    for (const seg of segments) {
      if (offset >= pos && offset < pos + seg.text.length) return seg.timestamp
      pos += seg.text.length
    }
    return 0
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const hasColoredWords = segments.some((s) => s.confidence < 0.8)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Screen Recorder</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Share your screen and record yourself giving a presentation or explanation in English.
          Your speech is transcribed live — grammar and fluency are checked automatically after recording.
        </p>
      </div>

      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative"
        style={{ aspectRatio: '16/9' }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          className={`w-full h-full object-contain ${capturing ? '' : 'hidden'}`}
        />
        {!capturing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-2">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-xl">&#9634;</div>
            <p className="text-sm">No screen shared yet</p>
          </div>
        )}
        {recording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-mono font-semibold tabular-nums">{fmt(elapsed)}</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {!capturing ? (
          <button
            onClick={startCapture}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            Share Screen
          </button>
        ) : (
          <>
            {!recording ? (
              <button
                onClick={startRecording}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
              >
                ● Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="px-5 py-2.5 bg-red-800 hover:bg-red-900 rounded-lg text-sm font-medium transition-colors"
              >
                ■ Stop Recording
              </button>
            )}
            <button
              onClick={() => stopAll(true)}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              Stop Sharing
            </button>
          </>
        )}
      </div>

      {/* Transcript */}
      {(recording || segments.length > 0) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Transcript</span>
            <div className="flex gap-3 items-center">
              {recording && <span className="text-red-400 font-mono font-semibold tabular-nums">{fmt(elapsed)}</span>}
              {fullText && (
                <button
                  onClick={() => navigator.clipboard.writeText(fullTextWithTimestamps)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Copy with timestamps
                </button>
              )}
            </div>
          </div>
          <div ref={transcriptScrollRef} className="overflow-y-auto max-h-64 min-h-16 pr-1">
            {!segments.length && !interim ? (
              <p className="text-zinc-600 text-sm italic">
                {recording ? 'Listening — start speaking…' : 'Your words will appear here when you record.'}
              </p>
            ) : (
              <p className="leading-relaxed text-base">
                {segments.map((seg, i) => (
                  <span key={i}>
                    <span className="text-xs font-mono text-zinc-600 select-none">[{fmt(seg.timestamp)}]</span>
                    {' '}
                    <span className={segmentColor(seg.confidence)} title={`Confidence: ${Math.round(seg.confidence * 100)}%`}>
                      {seg.text}
                    </span>
                  </span>
                ))}
                <span className="text-zinc-500 italic">{interim}</span>
              </p>
            )}
          </div>
          {hasColoredWords && !recording && (
            <div className="flex gap-4 mt-4 pt-3 border-t border-zinc-800">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-zinc-100 inline-block" /> Clear
              </span>
              <span className="text-xs text-yellow-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-300 inline-block" /> Uncertain
              </span>
              <span className="text-xs text-red-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Unclear
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {fullText && !recording && (
        <div className="flex gap-3 flex-wrap items-center">
          <button
            onClick={checkGrammar}
            disabled={grammarStatus === 'checking'}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg text-sm font-medium transition-colors"
          >
            {grammarStatus === 'checking' ? 'Checking…' : 'Check Grammar (free)'}
          </button>
          <button
            onClick={checkFluency}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 rounded-lg text-sm font-medium transition-colors"
          >
            Check Fluency &amp; Pronunciation
          </button>
          <button
            onClick={() => {
              setSegments([])
              setVideoUrl(null)
              setGrammarStatus('idle')
              setGrammarMatches([])
              setAnalyzeStatus('idle')
              setAnalyzeResult(null)
              savedSessionIdRef.current = null
            }}
            className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Grammar results */}
      {grammarStatus === 'done' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Grammar Feedback</span>
            <span className="text-xs text-zinc-700">LanguageTool — free</span>
          </div>
          {grammarMatches.length === 0 ? (
            <p className="text-green-400 text-sm font-medium">No issues found — your English looks great!</p>
          ) : (
            <div className="space-y-3">
              {grammarMatches.map((match, i) => {
                const errorText = fullText.slice(match.offset, match.offset + match.length)
                const suggestion = match.replacements[0]?.value
                const snippetStart = Math.max(0, match.offset - 55)
                const snippetEnd = Math.min(fullText.length, match.offset + match.length + 55)
                const before = fullText.slice(snippetStart, match.offset)
                const after = fullText.slice(match.offset + match.length, snippetEnd)
                return (
                  <div key={i} className="bg-zinc-800/60 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-zinc-600">[{fmt(getTimestampForOffset(match.offset))}]</span>
                      <span className="font-mono text-sm bg-red-950/50 text-red-300 px-2 py-0.5 rounded border border-red-900/50">
                        {errorText || '…'}
                      </span>
                      {suggestion && (
                        <>
                          <span className="text-zinc-600">&rarr;</span>
                          <span className="font-mono text-sm bg-green-950/50 text-green-300 px-2 py-0.5 rounded border border-green-900/50">
                            {suggestion}
                          </span>
                        </>
                      )}
                    </div>
                    {errorText && (
                      <p className="text-xs font-mono text-zinc-500 bg-zinc-900/70 rounded px-3 py-2 leading-relaxed">
                        {snippetStart > 0 && <span>…</span>}
                        {before}
                        <mark className="bg-red-900/60 text-red-200 rounded px-0.5">{errorText}</mark>
                        {after}
                        {snippetEnd < fullText.length && <span>…</span>}
                      </p>
                    )}
                    <p className="text-sm text-zinc-400">{match.message}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Fluency analysis */}
      {analyzeStatus === 'done' && analyzeResult && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Analysis Results</span>
            {analyzeResult.wpm !== null && (
              <span className="text-xs text-zinc-500 font-mono">{analyzeResult.wpm} wpm</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'Vocabulary',    score: analyzeResult.scores.vocabulary },
              { label: 'Grammar',       score: analyzeResult.scores.grammar },
              { label: 'Fluency',       score: analyzeResult.scores.fluency },
              { label: 'Pronunciation', score: analyzeResult.scores.pronunciation },
              { label: 'Confidence',    score: analyzeResult.scores.confidence },
            ] as const).map(({ label, score }) => (
              <div key={label} className="bg-zinc-800/60 rounded-lg p-3 space-y-2">
                <span className="text-xs text-zinc-500">{label}</span>
                {score !== null ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${score >= 8 ? 'bg-green-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${score * 10}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-zinc-200 tabular-nums w-8 text-right">{score}/10</span>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">{label === 'Grammar' ? 'Run Grammar Check first' : '—'}</p>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{analyzeResult.fluencyFeedback}</p>
          {analyzeResult.fillerWords.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Filler Words Detected</span>
              <div className="space-y-1.5 mt-2">
                {analyzeResult.fillerWords.map(({ word, count }) => {
                  const maxCount = analyzeResult.fillerWords[0].count
                  return (
                    <div key={word} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-300 font-mono w-20 shrink-0">{word}</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div className="h-2 rounded-full bg-orange-500/70" style={{ width: `${(count / maxCount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500 w-8 text-right shrink-0">{count}×</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {analyzeResult.improvements.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Top Improvements</span>
              <ul className="space-y-2 mt-2">
                {analyzeResult.improvements.map((imp, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-300">
                    <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Playback */}
      {videoUrl && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Recording</span>
          <video ref={playbackRef} controls src={videoUrl} className="w-full mt-2 rounded-lg" />
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-600 mr-1">Playback speed:</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => applySpeed(s)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  playbackSpeed === s ? 'bg-zinc-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const a = document.createElement('a')
              a.href = videoUrl
              a.download = `screen-practice-${Date.now()}.webm`
              a.click()
            }}
            className="text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Download video
          </button>
        </div>
      )}

      {!speechSupported && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-400">
          Live transcription requires Chrome or Edge. Screen recording works in all browsers.
        </div>
      )}
    </div>
  )
}
