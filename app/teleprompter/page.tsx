'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const DEFAULT_SCRIPT = `Welcome to English Lab!

Type or paste your own script here, then click Present to start practicing.

You can control the scroll speed with the slider. Try to read at a natural pace — don't rush the words.

Reading aloud every day is one of the best ways to improve your English fluency, pronunciation, and confidence.

Keep going. You're doing great!`

export default function TeleprompterPage() {
  const [mode, setMode] = useState<'edit' | 'present'>('edit')
  const [script, setScript] = useState(DEFAULT_SCRIPT)
  const [scrolling, setScrolling] = useState(false)
  const [speed, setSpeed] = useState(40)
  const [fontSize, setFontSize] = useState(36)
  const [recording, setRecording] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const scrollFrame = useCallback(
    (timestamp: number) => {
      if (!scrollRef.current) return
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = timestamp
        rafRef.current = requestAnimationFrame(scrollFrame)
        return
      }
      const pxPerSecond = speed * 0.8
      const delta = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp
      scrollRef.current.scrollBy(0, pxPerSecond * delta)
      rafRef.current = requestAnimationFrame(scrollFrame)
    },
    [speed],
  )

  useEffect(() => {
    if (scrolling) {
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(scrollFrame)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [scrolling, scrollFrame])

  const startRecording = async () => {
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
      setRecording(true)
      setAudioUrl(null)
    } catch (_) {
      alert('Microphone access required for recording.')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  const resetScroll = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setScrolling(false)
  }

  const wordCount = script.trim().split(/\s+/).filter(Boolean).length

  if (mode === 'present') {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col z-50">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-sm shrink-0 flex-wrap">
          <button
            onClick={() => { setMode('edit'); setScrolling(false) }}
            className="text-sm text-zinc-400 hover:text-white transition-colors mr-2"
          >
            &larr; Edit
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600">Speed</span>
            <input
              type="range"
              min={5}
              max={100}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-24 accent-zinc-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-600">Size</span>
            <input
              type="range"
              min={20}
              max={72}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-20 accent-zinc-400"
            />
          </div>

          <div className="flex gap-2 ml-auto">
            <button
              onClick={resetScroll}
              className="px-3 py-1.5 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setScrolling((s) => !s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                scrolling
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-zinc-700 hover:bg-zinc-600'
              }`}
            >
              {scrolling ? '⏸ Pause' : '▶ Scroll'}
            </button>
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                recording
                  ? 'bg-red-700 hover:bg-red-800 animate-pulse'
                  : 'bg-zinc-800 hover:bg-zinc-700'
              }`}
            >
              {recording ? '■ Stop' : '● Rec'}
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-8 py-16"
          style={{ scrollbarWidth: 'none' }}
        >
          <p
            className="text-white leading-relaxed whitespace-pre-wrap text-center mx-auto max-w-3xl"
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
          >
            {script}
          </p>
          <div className="h-screen" />
        </div>

        {audioUrl && !recording && (
          <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900 flex items-center gap-4 shrink-0">
            <audio controls src={audioUrl} className="flex-1 h-8" />
            <button
              onClick={() => {
                const a = document.createElement('a')
                a.href = audioUrl
                a.download = `teleprompter-${Date.now()}.webm`
                a.click()
              }}
              className="text-sm px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors whitespace-nowrap"
            >
              Download
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Teleprompter</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Type or paste your English script below, then click Present to read it aloud with
          auto-scroll. Record your voice as you practice.
        </p>
      </div>

      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">Text size</span>
          <input
            type="range"
            min={20}
            max={72}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-28 accent-zinc-400"
          />
          <span className="text-sm text-zinc-600 w-8 tabular-nums">{fontSize}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">Scroll speed</span>
          <input
            type="range"
            min={5}
            max={100}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-28 accent-zinc-400"
          />
          <span className="text-sm text-zinc-600 w-8 tabular-nums">{speed}</span>
        </div>
      </div>

      <textarea
        value={script}
        onChange={(e) => setScript(e.target.value)}
        rows={12}
        placeholder="Type or paste your English script here…"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-5 text-zinc-100 text-base leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-zinc-600 placeholder-zinc-700"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">{wordCount} words</span>
        <button
          onClick={() => setMode('present')}
          disabled={!script.trim()}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl text-sm font-semibold transition-colors"
        >
          Present &rarr;
        </button>
      </div>
    </div>
  )
}
