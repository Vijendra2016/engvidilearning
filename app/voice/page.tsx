'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { analyzeTranscript, type AnalysisResult } from '@/lib/analyze'

type Segment = { text: string; confidence: number }
type GrammarStatus = 'idle' | 'checking' | 'done'
type AnalyzeStatus = 'idle' | 'done'

interface LTMatch {
  message: string
  offset: number
  length: number
  replacements: { value: string }[]
}

export default function VoicePage() {
  const [recording, setRecording] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [interim, setInterim] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [grammarStatus, setGrammarStatus] = useState<GrammarStatus>('idle')
  const [grammarMatches, setGrammarMatches] = useState<LTMatch[]>([])
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>('idle')
  const [analyzeResult, setAnalyzeResult] = useState<AnalysisResult | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognizingRef = useRef(false)
  const interimRef = useRef('')

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  const fullText = segments.map((s) => s.text).join('')

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      recorderRef.current = recorder

      // Reset all state before starting recognition
      setElapsed(0)
      setSegments([])
      setAudioUrl(null)
      setGrammarStatus('idle')
      setGrammarMatches([])
      setAnalyzeStatus('idle')
      setAnalyzeResult(null)
      interimRef.current = ''
      setInterim('')

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) {
        recognizingRef.current = true
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
              const clean = r[0].transcript.replace(/[.,!?;:]/g, '').trim()
              if (clean) setSegments((prev) => [...prev, { text: clean + ' ', confidence: conf }])
            } else {
              inter += r[0].transcript
            }
          }
          interimRef.current = inter
          setInterim(inter)
        }
        recognition.onend = () => {
          if (recognizingRef.current) {
            // Save any interim words before the engine resets — prevents word loss during the ~60s restart
            const leftover = interimRef.current.replace(/[.,!?;:]/g, '').trim()
            if (leftover) setSegments((prev) => [...prev, { text: leftover + ' ', confidence: 0.8 }])
            interimRef.current = ''
            setInterim('')
            try { recognition.start() } catch (_) {}
          } else {
            interimRef.current = ''
            setInterim('')
          }
        }
        recognition.start()
        recognitionRef.current = recognition
      }

      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
      setRecording(true)
    } catch (_) {
      alert('Microphone access is required. Please allow it in your browser settings.')
    }
  }, [])

  const stop = useCallback(() => {
    recognizingRef.current = false
    // Capture any words still in interim before stopping
    const leftover = interimRef.current.replace(/[.,!?;:]/g, '').trim()
    if (leftover) setSegments((prev) => [...prev, { text: leftover + ' ', confidence: 0.8 }])
    interimRef.current = ''
    recorderRef.current?.stop()
    recognitionRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setInterim('')
  }, [])

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
    const result = analyzeTranscript(text, elapsed)
    setAnalyzeResult(result)
    setAnalyzeStatus('done')
  }

  const segmentColor = (conf: number) =>
    conf >= 0.8 ? 'text-zinc-100' : conf >= 0.6 ? 'text-yellow-300' : 'text-red-400'

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const hasColoredWords = segments.some((s) => s.confidence < 0.8)

  const scoreColor = (score: number) =>
    score >= 8
      ? 'bg-green-950/60 text-green-400 border-green-900/50'
      : score >= 5
      ? 'bg-amber-950/60 text-amber-400 border-amber-900/50'
      : 'bg-red-950/60 text-red-400 border-red-900/50'

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Voice Recorder</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Record yourself speaking English. Unclear words are highlighted — yellow means uncertain,
          red means unclear. Check grammar and fluency after recording.
        </p>
      </div>

      {/* Record button */}
      <div className="flex flex-col items-center gap-4 py-10">
        <button
          onClick={recording ? stop : start}
          className={`w-24 h-24 rounded-full text-sm font-semibold transition-all shadow-lg ${
            recording
              ? 'bg-red-600 hover:bg-red-700 ring-4 ring-red-600/30 animate-pulse'
              : 'bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700'
          }`}
        >
          {recording ? '■ Stop' : '● Record'}
        </button>
        {recording && (
          <span className="text-red-400 font-mono font-semibold text-xl tabular-nums">
            {fmt(elapsed)}
          </span>
        )}
      </div>

      {/* Transcript */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 min-h-48">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Transcript</span>
          {fullText && (
            <button
              onClick={() => navigator.clipboard.writeText(fullText)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Copy
            </button>
          )}
        </div>
        {!segments.length && !interim ? (
          <p className="text-zinc-600 text-sm italic">
            {recording ? 'Listening — start speaking…' : 'Your words will appear here when you record.'}
          </p>
        ) : (
          <p className="leading-relaxed text-base">
            {segments.map((seg, i) => (
              <span
                key={i}
                className={segmentColor(seg.confidence)}
                title={`Confidence: ${Math.round(seg.confidence * 100)}%`}
              >
                {seg.text}
              </span>
            ))}
            <span className="text-zinc-500 italic">{interim}</span>
          </p>
        )}
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
            Check Fluency & Pronunciation
          </button>
          <button
            onClick={() => {
              setSegments([])
              setAudioUrl(null)
              setGrammarStatus('idle')
              setGrammarMatches([])
              setAnalyzeStatus('idle')
              setAnalyzeResult(null)
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
            <p className="text-green-400 text-sm font-medium">
              No issues found — your English looks great!
            </p>
          ) : (
            <div className="space-y-3">
              {grammarMatches.map((match, i) => {
                const errorText = fullText.slice(match.offset, match.offset + match.length)
                const suggestion = match.replacements[0]?.value
                return (
                  <div key={i} className="bg-zinc-800/60 rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
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
                    <p className="text-sm text-zinc-400">{match.message}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Fluency & Pronunciation results */}
      {analyzeStatus === 'done' && analyzeResult && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Fluency & Pronunciation</span>
            <span className="text-xs text-zinc-700">Claude AI</span>
          </div>

          {/* Score + WPM + feedback */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col gap-2 flex-shrink-0">
              <div
                className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center border ${scoreColor(analyzeResult.fluencyScore)}`}
              >
                <span className="text-xl font-bold leading-none">{analyzeResult.fluencyScore}</span>
                <span className="text-xs opacity-70">/10</span>
              </div>
              {analyzeResult.wpm !== null && (
                <div className="w-14 h-8 rounded-lg flex items-center justify-center bg-zinc-800 border border-zinc-700">
                  <span className="text-xs text-zinc-400 font-mono leading-none">{analyzeResult.wpm}<span className="text-zinc-600"> wpm</span></span>
                </div>
              )}
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed pt-1">{analyzeResult.fluencyFeedback}</p>
          </div>

          {/* Pronunciation watch-list */}
          {analyzeResult.pronunciationTips.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Pronunciation Watch-list</span>
              <div className="space-y-2 mt-2">
                {analyzeResult.pronunciationTips.map((tip, i) => (
                  <div key={i} className="bg-zinc-800/60 rounded-lg p-4 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm bg-amber-950/50 text-amber-300 px-2 py-0.5 rounded border border-amber-900/50">
                        {tip.word}
                      </span>
                      <span className="text-zinc-600">&rarr;</span>
                      <span className="text-sm text-zinc-400 font-mono">{tip.phonetic}</span>
                    </div>
                    <p className="text-sm text-zinc-400">{tip.tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Improvements */}
          {analyzeResult.improvements.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Top Improvements</span>
              <ul className="space-y-2 mt-2">
                {analyzeResult.improvements.map((imp, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-300">
                    <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs text-zinc-600 border-t border-zinc-800 pt-3">
            Note: browser speech recognition removes filler words (um, uh, like) from transcripts. Play back your recording to check for hesitations.
          </p>
        </div>
      )}

      {/* Audio playback */}
      {audioUrl && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Playback</span>
          <audio controls src={audioUrl} className="w-full mt-2" />
          <button
            onClick={() => {
              const a = document.createElement('a')
              a.href = audioUrl
              a.download = `english-practice-${Date.now()}.webm`
              a.click()
            }}
            className="text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Download recording
          </button>
        </div>
      )}

      {!speechSupported && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-400">
          Live transcription requires Chrome or Edge. Recording works in all browsers.
        </div>
      )}
    </div>
  )
}
