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
    <div className="border-t border-huginn-border bg-huginn-base p-4 md:p-6">
      <div className="flex items-end gap-3 max-w-3xl">
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
          className="flex-1 bg-huginn-card text-white rounded-lg px-4 py-3 text-sm outline-none border border-huginn-border focus:border-huginn-accent focus:ring-1 focus:ring-huginn-accent placeholder-huginn-text-muted resize-none disabled:opacity-50"
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
