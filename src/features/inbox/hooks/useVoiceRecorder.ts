import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList
  resultIndex: number
}

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export function useVoiceRecorder() {
  const { i18n } = useTranslation()
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const recognitionRef = useRef<InstanceType<NonNullable<typeof SpeechRecognition>> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Finalised speech segments are committed here; interim results are shown on
  // top without polluting the final text. Prevents the "thisthis isthis is
  // very broken" duplication caused by interim results piling up.
  const finalTextRef = useRef('')
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

    finalTextRef.current = ''
    setTranscript('')
    setDuration(0)

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = i18n.language === 'is' ? 'is-IS' : 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript
        if (result.isFinal) {
          // Add a space between finalised utterances for readability.
          const needsSpace = finalTextRef.current && !/\s$/.test(finalTextRef.current)
          finalTextRef.current += (needsSpace ? ' ' : '') + text.trim()
        } else {
          interim = text
        }
      }
      const separator = finalTextRef.current && interim ? ' ' : ''
      setTranscript(finalTextRef.current + separator + interim)
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
  }, [stopRecording, i18n.language])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return { isRecording, transcript, duration, startRecording, stopRecording, isSupported }
}
