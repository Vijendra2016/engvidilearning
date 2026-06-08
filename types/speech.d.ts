// Ambient declarations for Web Speech API (not in TypeScript's DOM lib)

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((event: Event) => void) | null
}

interface Window {
  SpeechRecognition: new () => SpeechRecognitionInstance
  webkitSpeechRecognition: new () => SpeechRecognitionInstance
}
