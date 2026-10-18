import { useEffect, useRef, useState } from 'react'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { EmptyState } from '../../components/EmptyState'
import { Icon } from '../../components/Icon'
import { useToast } from '../../components/Toaster'
import { formatTimestamp } from '../../domain/dates'
import type { VoiceNote } from '../../domain/types'
import { useVoiceNotes } from '../../hooks/useData'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { t } from '../../i18n'

const MAX_RECORDING_MS = 10 * 60 * 1000
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus']

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

function VoiceNoteItem({ note }: { note: VoiceNote }) {
  const repos = useRepos()
  const toast = useToast()
  const url = useObjectUrl(note.data, note.mimeType)
  const [title, setTitle] = useState(note.title)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
        <button type="button" className="btn-ghost btn-sm px-2" aria-label={t('Delete voice note')} onClick={() => setConfirmDelete(true)}>
          <Icon name="trash" className="size-4" />
        </button>
      </div>
      <p className="text-xs text-muted">
        {formatTimestamp(note.createdAt)} · {formatDuration(note.durationMs)}
      </p>
      {url && <audio className="mt-3 w-full" controls preload="metadata" src={url} />}
      <ConfirmDialog
        open={confirmDelete}
        title={t('Delete this voice note?')}
        confirmLabel={t('Delete permanently')}
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          await repos.voiceNotes.delete(note.id)
          toast(t('Voice note deleted.'))
        }}
      >
        <p>{t('It will be permanently removed from this device.')}</p>
      </ConfirmDialog>
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
