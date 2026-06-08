'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export default function VoicePage() {
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognizingRef = useRef(false)

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      recorderRef.current = recorder

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SR) {
        recognizingRef.current = true
        const recognition = new SR()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onresult = (e) => {
          let final = ''
          let inter = ''
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) final += e.results[i][0].transcript + ' '
            else inter += e.results[i][0].transcript
          }
          if (final) setTranscript((t) => t + final)
          setInterim(inter)
        }
        recognition.onend = () => {
          if (recognizingRef.current) {
            try { recognition.start() } catch (_) { /* already restarting */ }
          } else {
            setInterim('')
          }
        }
        recognition.start()
        recognitionRef.current = recognition
      }

      setElapsed(0)
      setTranscript('')
      setAudioUrl(null)
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
      setRecording(true)
    } catch (_) {
      alert('Microphone access is required. Please allow it in your browser settings.')
    }
  }, [])

  const stop = useCallback(() => {
    recognizingRef.current = false
    recorderRef.current?.stop()
    recognitionRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }, [])

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Voice Recorder</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Record yourself speaking English and see your words written out in real time.
          Great for practicing pronunciation and fluency.
        </p>
      </div>

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

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 min-h-48">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Transcript</span>
          {(transcript || interim) && (
            <button
              onClick={() => navigator.clipboard.writeText(transcript)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Copy
            </button>
          )}
        </div>
        {!transcript && !interim ? (
          <p className="text-zinc-600 text-sm italic">
            {recording ? 'Listening — start speaking…' : 'Your words will appear here when you record.'}
          </p>
        ) : (
          <p className="text-zinc-100 leading-relaxed text-base">
            {transcript}
            <span className="text-zinc-500 italic">{interim}</span>
          </p>
        )}
      </div>

      {transcript && (
        <button
          onClick={() => { setTranscript(''); setAudioUrl(null) }}
          className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Clear transcript
        </button>
      )}

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
