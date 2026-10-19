import { useEffect, useRef, useState } from 'react'
import { useRepos } from '../../app/repos'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toaster'
import { formatTimestamp } from '../../domain/dates'
import type { VoiceNote } from '../../domain/types'
import { useVoiceNotes } from '../../hooks/useData'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { t } from '../../i18n'

const MAX_RECORDING_MS = 10 * 60 * 1000
/**
 * MP4/AAC first: it plays on every major browser, so a recording made on one device
 * (or restored from a backup) also plays on another. WebM/Ogg are fallbacks.
 */
const MIME_CANDIDATES = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']

/** Whether this browser says it can play a stored recording's format. */
function canPlay(mimeType: string): boolean {
  if (typeof document === 'undefined') return true
  return document.createElement('audio').canPlayType(mimeType.split(';')[0]) !== ''
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type))
}

function formatDuration(ms: number) {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function voiceRecordingSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/** Say it out loud instead of typing. Recordings stay on this device; the microphone is used only while recording. */
function Recorder({ onSaved }: { onSaved: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const [state, setState] = useState<'idle' | 'recording' | 'saving'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const startedAt = useRef(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current)
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  const start = async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        if (timer.current) clearInterval(timer.current)
        const durationMs = Date.now() - startedAt.current
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        if (blob.size === 0) {
          setError(t('Nothing was recorded. Check that your microphone is connected and not muted.'))
          setState('idle')
          setElapsed(0)
          return
        }
        setState('saving')
        try {
          await repos.voiceNotes.add({ title: '', blob, durationMs })
          toast(t('Voice note saved.'))
          onSaved()
        } catch {
          setError(t('The recording could not be saved. Your device may be out of space.'))
        } finally {
          setState('idle')
          setElapsed(0)
        }
      }
      recorderRef.current = recorder
      startedAt.current = Date.now()
      recorder.start(1000)
      setState('recording')
      timer.current = setInterval(() => {
        const ms = Date.now() - startedAt.current
        setElapsed(ms)
        if (ms >= MAX_RECORDING_MS) recorder.stop()
      }, 250)
    } catch {
      setError(t('Microphone access was not allowed. You can change this in your browser settings.'))
    }
  }

  return (
    <div className="card">
      {state === 'recording' ? (
        <div className="flex items-center gap-4">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-50" />
            <span className="relative inline-flex size-3 rounded-full bg-danger" />
          </span>
          <span className="flex-1 font-mono text-lg tabular-nums" aria-live="off">
            {formatDuration(elapsed)}
          </span>
          <button type="button" className="btn-primary" onClick={() => recorderRef.current?.stop()}>
            <Icon name="stop" className="size-4" />
            {t('Stop and save')}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-sm text-muted">{t('Say it out loud. The recording stays on this device and is never sent.')}</p>
          <button type="button" className="btn-primary" onClick={() => void start()} disabled={state === 'saving'}>
            <Icon name="mic" className="size-4" />
            {state === 'saving' ? t('Saving…') : t('Record')}
          </button>
        </div>
      )}
      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * A small player. Uses the duration saved at recording time: WebM files from
 * MediaRecorder often report an "Infinity" duration to the browser.
 */
function VoicePlayer({ note }: { note: VoiceNote }) {
  const url = useObjectUrl(note.data, note.mimeType, `${note.id}:${note.updatedAt}`)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [failed, setFailed] = useState(() => !canPlay(note.mimeType))
  const totalSeconds = Math.max(note.durationMs / 1000, 0.1)

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (!audio.paused) {
      audio.pause()
      return
    }
    try {
      if (audio.ended || position >= totalSeconds - 0.05) audio.currentTime = 0
      await audio.play()
    } catch {
      setFailed(true)
    }
  }

  if (failed) {
    return (
      <p className="mt-3 text-sm text-muted" role="status">
        {t('This recording is in a format this browser cannot play ({format}). It may play on the device that recorded it.', {
          format: note.mimeType.split(';')[0].replace('audio/', '').toUpperCase(),
        })}
      </p>
    )
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setPosition(totalSeconds)
          }}
          onTimeUpdate={(e) => setPosition(Math.min(e.currentTarget.currentTime, totalSeconds))}
          onError={() => setFailed(true)}
        />
      )}
      <button
        type="button"
        className="btn-primary size-11 shrink-0 rounded-full p-0"
        aria-label={playing ? t('Pause') : t('Play')}
        disabled={!url}
        onClick={() => void toggle()}
      >
        <Icon name={playing ? 'pause' : 'play'} className="size-4" />
      </button>
      <input
        type="range"
        className="min-w-0 flex-1 accent-[var(--accent)]"
        min={0}
        max={totalSeconds}
        step={0.1}
        value={position}
        aria-label={t('Playback position')}
        onChange={(e) => {
          const next = Number(e.target.value)
          setPosition(next)
          if (audioRef.current) audioRef.current.currentTime = next
        }}
      />
      <span className="shrink-0 text-xs text-muted tabular-nums">
        {formatDuration(position * 1000)} / {formatDuration(note.durationMs)}
      </span>
    </div>
  )
}

function VoiceNoteItem({ note }: { note: VoiceNote }) {
  const repos = useRepos()
  const [title, setTitle] = useState(note.title)
  const deleteWithUndo = useDeleteWithUndo()

  return (
    <li className="card">
      <div className="flex items-center gap-2">
        <input
          className="min-w-0 flex-1 bg-transparent font-medium focus:outline-none"
          value={title}
          placeholder={t('Untitled voice note')}
          aria-label={t('Voice note title')}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== note.title && void repos.voiceNotes.rename(note.id, title)}
        />
        <button type="button" className="btn-ghost btn-sm px-2" aria-label={t('Delete voice note')} onClick={() => void deleteWithUndo(() => repos.voiceNotes.delete(note.id), t('Voice note moved to Recently deleted.'))}
        >
          <Icon name="trash" className="size-4" />
        </button>
      </div>
      <p className="text-xs text-muted">
        {formatTimestamp(note.createdAt)} · {formatDuration(note.durationMs)}
      </p>
      <VoicePlayer note={note} />
    </li>
  )
}

export function VoiceNotes() {
  const notes = useVoiceNotes()
  const supported = voiceRecordingSupported()
  return (
    <div className="space-y-4">
      {supported ? <Recorder onSaved={() => {}} /> : <p className="hint">{t('Voice recording is not supported in this browser.')}</p>}
      {!notes ? null : notes.length === 0 ? (
        <EmptyState message={t('Sometimes it is easier to say it than to write it.')} />
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <VoiceNoteItem key={note.id} note={note} />
          ))}
        </ul>
      )}
    </div>
  )
}
