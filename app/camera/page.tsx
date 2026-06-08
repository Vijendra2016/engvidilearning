'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export default function CameraPage() {
  const [streaming, setStreaming] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [speechSupported, setSpeechSupported] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognizingRef = useRef(false)

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

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
      setTranscript('')
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
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setVideoUrl(URL.createObjectURL(blob))
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
          try { recognition.start() } catch (_) { /* restarting */ }
        } else {
          setInterim('')
        }
      }
      recognition.start()
      recognitionRef.current = recognition
    }

    setElapsed(0)
    setTranscript('')
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
    setRecording(true)
  }, [])

  const stopRecording = useCallback(() => {
    recognizingRef.current = false
    recorderRef.current?.stop()
    recognitionRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
    setInterim('')
  }, [])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Self Video</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Record yourself on camera to review your body language, eye contact, and expressions.
          Your speech is transcribed so you can paste it into Claude or ChatGPT for English feedback.
        </p>
      </div>

      {/* Camera preview */}
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden relative"
        style={{ aspectRatio: '4/3' }}
      >
        {/* Preview is mirrored — feels natural like a mirror */}
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

      {/* Live transcript */}
      {(recording || (transcript && streaming)) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Live Transcript</span>
            {transcript && (
              <button
                onClick={() => navigator.clipboard.writeText(transcript)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Copy
              </button>
            )}
          </div>
          {!transcript && !interim ? (
            <p className="text-zinc-600 text-sm italic">Listening — start speaking…</p>
          ) : (
            <p className="text-zinc-100 leading-relaxed">
              {transcript}
              <span className="text-zinc-500 italic">{interim}</span>
            </p>
          )}
        </div>
      )}

      {/* Playback + transcript after recording */}
      {videoUrl && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Your Recording</span>
          {/* Playback is NOT mirrored — shows how others see you */}
          <video controls src={videoUrl} className="w-full mt-2 rounded-lg" />
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
            {transcript && (
              <button
                onClick={() => navigator.clipboard.writeText(transcript)}
                className="text-sm px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                Copy transcript
              </button>
            )}
          </div>

          {transcript && (
            <div className="border-t border-zinc-800 pt-4 space-y-2">
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Transcript</span>
              <p className="text-zinc-300 text-sm leading-relaxed mt-2">{transcript}</p>
            </div>
          )}
        </div>
      )}

      {/* AI feedback prompt hint */}
      {transcript && !recording && (
        <div className="bg-indigo-950/40 border border-indigo-800/40 rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-indigo-300">Get AI feedback on your English</p>
          <p className="text-sm text-indigo-400/80 leading-relaxed">
            Copy your transcript and paste it into Claude or ChatGPT. Ask it to correct your
            grammar, suggest better words, or explain what you could say more naturally.
          </p>
          <div className="bg-indigo-950/60 rounded-lg p-3 border border-indigo-900/50">
            <p className="text-xs text-indigo-400 font-mono leading-relaxed">
              &ldquo;Here is what I said in English. Please correct any grammar mistakes,
              suggest more natural phrases, and explain the corrections:
              <br /><br />
              [paste your transcript here]&rdquo;
            </p>
          </div>
          <button
            onClick={() =>
              navigator.clipboard.writeText(
                `Here is what I said in English. Please correct any grammar mistakes, suggest more natural phrases, and explain the corrections:\n\n${transcript}`
              )
            }
            className="text-sm px-4 py-2 bg-indigo-700 hover:bg-indigo-600 rounded-lg transition-colors font-medium"
          >
            Copy prompt + transcript
          </button>
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
