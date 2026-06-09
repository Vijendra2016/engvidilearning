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

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5]

export default function CameraPage() {
  const [streaming, setStreaming] = useState(false)
  const [recording, setRecording] = useState(false)
  const [segments, setSegments] = useState<Segment[]>([])
  const [interim, setInterim] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)
  const [grammarStatus, setGrammarStatus] = useState<GrammarStatus>('idle')
  const [grammarMatches, setGrammarMatches] = useState<LTMatch[]>([])
  const [analyzeStatus, setAnalyzeStatus] = useState<AnalyzeStatus>('idle')
  const [analyzeResult, setAnalyzeResult] = useState<AnalysisResult | null>(null)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognizingRef = useRef(false)
  const interimRef = useRef('')

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  const fullText = segments.map((s) => s.text).join('')

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setStreaming(true)
      setVideoUrl(null)
      setSegments([])
      setGrammarStatus('idle')
      setGrammarMatches([])
      setAnalyzeStatus('idle')
      setAnalyzeResult(null)
    } catch (_) {
      alert('Camera and microphone access is required. Please allow it in your browser settings.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
    recognizingRef.current = false
    recognitionRef.current?.stop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    if (timerRef.current) clearInterval(timerRef.current)
    setStreaming(false)
    setRecording(false)
  }, [])

  const startRecording = useCallback(() => {
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

    // Reset all state before starting recognition
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
  }, [])

  const stopRecording = useCallback(() => {
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
    const result = analyzeTranscript(text, elapsed, {
      segments,
      grammarMatches: grammarStatus === 'done' ? grammarMatches : undefined,
    })
    setAnalyzeResult(result)
    setAnalyzeStatus('done')
  }

  const applySpeed = (speed: number) => {
    setPlaybackSpeed(speed)
    if (playbackRef.current) playbackRef.current.playbackRate = speed
  }

  const segmentColor = (conf: number) =>
    conf >= 0.8 ? 'text-zinc-100' : conf >= 0.6 ? 'text-yellow-300' : 'text-red-400'

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const hasColoredWords = segments.some((s) => s.confidence < 0.8)

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Self Video</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Record yourself on camera to review body language and expressions. Words are color-coded
          by clarity, and you can check grammar and fluency after each recording.
        </p>
      </div>

      {/* Camera preview — mirrored so it feels like a mirror */}
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative"
        style={{ aspectRatio: '4/3' }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)', display: streaming ? 'block' : 'none' }}
        />
        {!streaming && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-600">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 7l-7 5 7 5V7z" />
              <rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
            <p className="text-sm">Camera not started</p>
          </div>
        )}
        {recording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-mono font-semibold tabular-nums">{fmt(elapsed)}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3 flex-wrap">
        {!streaming ? (
          <button
            onClick={startCamera}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
          >
            Start Camera
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
                className="px-5 py-2.5 bg-red-800 hover:bg-red-900 rounded-lg text-sm font-medium animate-pulse transition-colors"
              >
                ■ Stop Recording
              </button>
            )}
            <button
              onClick={stopCamera}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
            >
              Stop Camera
            </button>
          </>
        )}
      </div>

      {/* Live transcript while recording */}
      {(recording || (segments.length > 0 && streaming)) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Live Transcript</span>
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
            <p className="text-zinc-600 text-sm italic">Listening — start speaking…</p>
          ) : (
            <p className="leading-relaxed">
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
        </div>
      )}

      {/* Playback section */}
      {videoUrl && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Your Recording</span>

          {/* Playback is NOT mirrored — see yourself as others see you */}
          <video ref={playbackRef} controls src={videoUrl} className="w-full mt-2 rounded-lg" />

          {/* Speed control */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-600 mr-1">Playback speed:</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                onClick={() => applySpeed(s)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  playbackSpeed === s
                    ? 'bg-zinc-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => {
                const a = document.createElement('a')
                a.href = videoUrl
                a.download = `self-video-${Date.now()}.webm`
                a.click()
              }}
              className="text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
            >
              Download video
            </button>
            {fullText && (
              <button
                onClick={() => navigator.clipboard.writeText(fullText)}
                className="text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Copy transcript
              </button>
            )}
          </div>

          {/* Transcript with confidence colors */}
          {fullText && (
            <div className="border-t border-zinc-800 pt-5 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-zinc-500 uppercase tracking-widest">Transcript</span>
                <div className="flex gap-2">
                  <button
                    onClick={checkGrammar}
                    disabled={grammarStatus === 'checking'}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
                  >
                    {grammarStatus === 'checking' ? 'Checking…' : 'Check Grammar (free)'}
                  </button>
                  <button
                    onClick={checkFluency}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Check Fluency
                  </button>
                </div>
              </div>
              <p className="text-sm leading-relaxed">
                {segments.map((seg, i) => (
                  <span
                    key={i}
                    className={segmentColor(seg.confidence)}
                    title={`Confidence: ${Math.round(seg.confidence * 100)}%`}
                  >
                    {seg.text}
                  </span>
                ))}
              </p>
              {hasColoredWords && (
                <div className="flex gap-4">
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

      {/* Full analysis results */}
      {analyzeStatus === 'done' && analyzeResult && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Analysis Results</span>
            {analyzeResult.wpm !== null && (
              <span className="text-xs text-zinc-500 font-mono">{analyzeResult.wpm} wpm</span>
            )}
          </div>

          {/* Score grid */}
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { label: 'Vocabulary',    score: analyzeResult.scores.vocabulary },
                { label: 'Grammar',       score: analyzeResult.scores.grammar },
                { label: 'Fluency',       score: analyzeResult.scores.fluency },
                { label: 'Pronunciation', score: analyzeResult.scores.pronunciation },
                { label: 'Confidence',    score: analyzeResult.scores.confidence },
              ] as const
            ).map(({ label, score }) => (
              <div key={label} className="bg-zinc-800/60 rounded-lg p-3 space-y-2">
                <span className="text-xs text-zinc-500">{label}</span>
                {score !== null ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          score >= 8 ? 'bg-green-500' : score >= 5 ? 'bg-amber-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${score * 10}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-zinc-200 tabular-nums w-8 text-right">{score}/10</span>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600">
                    {label === 'Grammar' ? 'Run Grammar Check first' : '—'}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Fluency feedback */}
          <p className="text-sm text-zinc-300 leading-relaxed">{analyzeResult.fluencyFeedback}</p>

          {/* Filler words */}
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
                        <div
                          className="h-2 rounded-full bg-orange-500/70"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 w-8 text-right shrink-0">{count}×</span>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-zinc-600">&quot;like&quot;, &quot;just&quot;, &quot;well&quot; may include legitimate uses — listen to your recording to confirm. &quot;um&quot; and &quot;uh&quot; are removed by the browser and cannot be counted here.</p>
            </div>
          )}

          {/* Top repeated words */}
          {analyzeResult.topRepeatedWords.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Most Repeated Words</span>
              <div className="space-y-1.5 mt-2">
                {analyzeResult.topRepeatedWords.map(({ word, count }) => {
                  const maxCount = analyzeResult.topRepeatedWords[0].count
                  return (
                    <div key={word} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-300 font-mono w-20 shrink-0">{word}</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-2 rounded-full bg-blue-500/70"
                          style={{ width: `${(count / maxCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-500 w-8 text-right shrink-0">{count}×</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

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
                    <span className="text-violet-400 mt-0.5 shrink-0">•</span>
                    <span>{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!speechSupported && (
        <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 p-4 text-sm text-amber-400">
          Live transcription requires Chrome or Edge. Video recording still works in all browsers.
        </div>
      )}
    </div>
  )
}
