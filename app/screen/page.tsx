'use client'

import { useState, useRef } from 'react'

export default function ScreenPage() {
  const [capturing, setCapturing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const stopAll = (stopRecorder = true) => {
    if (stopRecorder && recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setCapturing(false)
    setRecording(false)
  }

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream

      stream.getTracks().forEach((track) => {
        track.onended = () => stopAll(true)
      })

      setCapturing(true)
      setVideoUrl(null)
    } catch (_) {
      // User cancelled the share dialog
    }
  }

  const startRecording = () => {
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
    setRecording(true)
    setVideoUrl(null)
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Screen Recorder</h1>
        <p className="text-zinc-400 text-sm leading-relaxed">
          Share your screen and record yourself giving a presentation or explanation in English.
          Watch the recording back to find areas to improve.
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
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center text-xl">
              &#9634;
            </div>
            <p className="text-sm">No screen shared yet</p>
          </div>
        )}
        {recording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 rounded-full px-3 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-medium">REC</span>
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

      {videoUrl && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Recording</span>
          <video controls src={videoUrl} className="w-full mt-2 rounded-lg" />
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

      <p className="text-xs text-zinc-600">
        Tip: Share a tab or window, then click Start Recording. Speak in English while your screen records.
        You can also tick &quot;Share tab audio&quot; in Chrome to capture sound from the tab.
      </p>
    </div>
  )
}
