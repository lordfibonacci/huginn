import { useCallback, useEffect, useRef, useState } from 'react'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { VoiceButton } from './VoiceButton'
import type { Thought } from '../../../shared/lib/types'

interface ThoughtInputProps {
  onSubmit: (body: string, source: 'text' | 'voice') => Promise<Thought | null>
}

export function ThoughtInput({ onSubmit }: ThoughtInputProps) {
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [source, setSource] = useState<'text' | 'voice'>('text')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const {
    isRecording,
    transcript,
    duration,
    startRecording,
    stopRecording,
    isSupported,
  } = useVoiceRecorder()

  // Auto-grow textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
  }, [body])

  // Fill transcript into input when recording stops
  useEffect(() => {
    if (!isRecording && transcript) {
      setBody(transcript)
      setSource('voice')
      textareaRef.current?.focus()
    }
  }, [isRecording, transcript])

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      setBody('')
      setSource('voice')
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  async function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || submitting) return

    setSubmitting(true)
    const result = await onSubmit(trimmed, source)
    setSubmitting(false)

    if (result) {
      setBody('')
      setSource('text')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-[#2a2a4a] bg-[#1a1a2e] px-3 py-3 pb-[env(safe-area-inset-bottom,12px)]">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            if (source === 'voice') setSource('text')
          }}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? 'Listening...' : "What's on your mind?"}
          disabled={isRecording}
          rows={1}
          className="flex-1 bg-[#2a2a4a] text-white rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#6c5ce7] placeholder-gray-500 resize-none disabled:opacity-50"
        />
        {isSupported && (
          <VoiceButton
            isRecording={isRecording}
            duration={duration}
            onToggle={handleToggleRecording}
          />
        )}
      </div>
    </div>
  )
}
