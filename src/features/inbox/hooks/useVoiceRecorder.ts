import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognition>> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isSupported = SpeechRecognition !== null

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRecording(false)
    setDuration(0)
  }, [])

  const startRecording = useCallback(() => {
    if (!SpeechRecognition) return

    setTranscript('')
    setDuration(0)

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let final = ''
      for (let i = 0; i < event.results.length; i++) {
        final += event.results[i][0].transcript
      }
      setTranscript(final)
    }

    recognition.onerror = () => {
      stopRecording()
    }

    recognition.onend = () => {
      setIsRecording(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    recognition.start()
    recognitionRef.current = recognition
    setIsRecording(true)

    timerRef.current = setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)
  }, [stopRecording])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { isRecording, transcript, duration, startRecording, stopRecording, isSupported }
}
