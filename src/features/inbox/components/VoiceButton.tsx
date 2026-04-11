interface VoiceButtonProps {
  isRecording: boolean
  duration: number
  onToggle: () => void
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function VoiceButton({ isRecording, duration, onToggle }: VoiceButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
        isRecording
          ? 'bg-red-500 animate-pulse'
          : 'bg-[#6c5ce7] hover:bg-[#5b4bd5]'
      }`}
      title={isRecording ? 'Stop recording' : 'Start voice note'}
    >
      {isRecording ? (
        <span className="text-xs font-mono text-white">{formatDuration(duration)}</span>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-white"
        >
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z" />
          <path d="M17 11a1 1 0 0 1 2 0 7 7 0 0 1-6 6.93V20h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 11a1 1 0 0 1 2 0 5 5 0 0 0 10 0Z" />
        </svg>
      )}
    </button>
  )
}
