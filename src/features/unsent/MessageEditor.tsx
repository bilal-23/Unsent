import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { useRepos } from '../../app/repos'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { PromptHelper } from '../../components/PromptHelper'
import { SaveStatus } from '../../components/SaveStatus'
import { useToast } from '../../components/Toaster'
import { StorageError } from '../../db/errors'
import { addDays, daysBetween, formatLocalDate, formatTimestamp, isValidLocalDate } from '../../domain/dates'
import { isReadyToOpen, isSealed } from '../../domain/sealing'
import type { UnsentMessage } from '../../domain/types'
import { useMessage, usePersonalItems, usePreferences } from '../../hooks/useData'
import { useDeleteWithUndo } from '../../hooks/useDeleteWithUndo'
import { useToday } from '../../hooks/useToday'
import { t } from '../../i18n'
import { AutosaveController, type AutosaveStatus } from '../../lib/AutosaveController'
import { registerFlusher } from '../../lib/autosaveRegistry'
import { readJson, removeKey, STORAGE_KEYS, writeJson } from '../../lib/storage'
import type { Repos } from '../../repositories'
import { normalizeTags, type MessageDraft } from '../../repositories/messagesRepo'

interface ShadowDraft extends MessageDraft {
  at: number
}

const EMPTY: MessageDraft = { title: '', body: '', tags: [] }
const isEmptyDraft = (d: MessageDraft) => !d.title.trim() && !d.body.trim()
const sameContent = (a: MessageDraft, b: MessageDraft) => a.title === b.title && a.body === b.body && a.tags.join('\u0000') === b.tags.join('\u0000')
const toDraft = (m: UnsentMessage): MessageDraft => ({ title: m.title, body: m.body, tags: m.tags })
const parseTags = (text: string) => normalizeTags(text.split(','))

/**
 * Route wrapper. `/unsent/new` becomes `/unsent/:id` once the first words are
 * saved; the editor instance survives that change because `editorKey` is carried
 * in the navigation state. Every visit to "new" gets its own key (instance id +
 * visit counter), so a fresh draft can never reuse — and overwrite — the editor
 * of the message written just before it.
 */
export function MessageEditor() {
  const { id = 'new' } = useParams()
  const location = useLocation()
  const instance = useId()
  const isNew = id === 'new'
  const [visit, setVisit] = useState({ count: 0, onNew: isNew })
  // Adjust state while rendering when we arrive at "new" from another message.
  if (visit.onNew !== isNew) setVisit({ count: isNew ? visit.count + 1 : visit.count, onNew: isNew })
  const carried = (location.state as { editorKey?: string } | null)?.editorKey
  const editorKey = isNew ? `new${instance}${visit.onNew === isNew ? visit.count : visit.count + 1}` : (carried ?? id)
  return <EditorLoader key={editorKey} editorKey={editorKey} routeId={isNew ? null : id} />
}

/** Loads the stored message once, then hands it to the editor as initial state. */
function EditorLoader({ editorKey, routeId }: { editorKey: string; routeId: string | null }) {
  const [mountedId] = useState(routeId)
  const loaded = useMessage(mountedId)
  const record = loaded?.id === mountedId ? loaded : undefined
  const [initial, setInitial] = useState<UnsentMessage | null | undefined>(mountedId ? undefined : null)

  // Adjusting state from a finished load (React's "store info from previous renders" pattern).
  if (initial === undefined && record?.value) setInitial(record.value)

  if (initial === undefined) {
    if (record && !record.value) {
      return (
        <div>
          <p className="text-muted">{t('This message no longer exists.')}</p>
          <Link to="/unsent" className="link mt-3 inline-block">
            {t('Back to messages')}
          </Link>
        </div>
      )
    }
    return <p className="hint">{t('Loading…')}</p>
  }
  return <Editor editorKey={editorKey} initial={initial} />
}

interface AutosaveDeps {
  repos: Repos
  editorKey: string
  idRef: RefObject<string | null>
  baseRevRef: RefObject<number>
  shadowEnabled: boolean
  onCreated: (id: string) => void
  onStatus: (status: AutosaveStatus, error: unknown) => void
}

/** Wires the generic autosave controller to message storage. Defined outside the component on purpose. */
function createMessageAutosave({ repos, editorKey, idRef, baseRevRef, shadowEnabled, onCreated, onStatus }: AutosaveDeps) {
  const shadowKey = () => STORAGE_KEYS.draft(idRef.current ?? editorKey)
  return new AutosaveController<MessageDraft>({
    save: async (value) => {
      if (!idRef.current) {
        if (isEmptyDraft(value)) return
        const created = await repos.messages.create(value)
        removeKey('sessionStorage', STORAGE_KEYS.draft(editorKey))
        idRef.current = created.id
        baseRevRef.current = created.rev
        onCreated(created.id)
        return
      }
      const saved = await repos.messages.save(idRef.current, value, baseRevRef.current)
      baseRevRef.current = saved.rev
    },
    isConflict: (error) => error instanceof StorageError && (error.kind === 'conflict' || error.kind === 'notFound'),
    onStatus: (status, error) => onStatus(status, error),
    shadow: shadowEnabled
      ? {
          write: (value) => writeJson('sessionStorage', shadowKey(), { ...value, at: Date.now() } satisfies ShadowDraft),
          clear: () => removeKey('sessionStorage', shadowKey()),
        }
      : undefined,
  })
}

function readShadow(key: string, against: MessageDraft | null): ShadowDraft | null {
  const shadow = readJson<ShadowDraft>('sessionStorage', key)
  if (!shadow || isEmptyDraft(shadow)) return null
  if (against && sameContent(shadow, against)) {
    removeKey('sessionStorage', key)
    return null
  }
  return shadow
}

function Editor({ editorKey, initial }: { editorKey: string; initial: UnsentMessage | null }) {
  const repos = useRepos()
  const navigate = useNavigate()
  const toast = useToast()
  const today = useToday()
  const preferences = usePreferences()
  const reasons = usePersonalItems('reason')
  const deleteWithUndo = useDeleteWithUndo()
  const shadowEnabled = !repos.lock.isEnabled()

  const [liveId, setLiveId] = useState<string | null>(initial?.id ?? null)
  const loadedRecord = useMessage(liveId)
  const record = loadedRecord && loadedRecord.id === liveId ? loadedRecord : undefined

  const [draft, setDraft] = useState<MessageDraft>(() => (initial ? toDraft(initial) : EMPTY))
  const [tagsText, setTagsText] = useState(() => initial?.tags.join(', ') ?? '')
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [statusError, setStatusError] = useState<unknown>(null)
  const [conflict, setConflict] = useState<UnsentMessage | null>(null)
  const [deletedElsewhere, setDeletedElsewhere] = useState(false)
  const [recovered, setRecovered] = useState<ShadowDraft | null>(() =>
    shadowEnabled ? readShadow(STORAGE_KEYS.draft(initial?.id ?? editorKey), initial ? toDraft(initial) : null) : null,
  )
  const [openedLetter] = useState<string | null>(() => (initial && isReadyToOpen(initial, today) ? (initial.sealedAt ?? '') : null))
  const [sealOpen, setSealOpen] = useState(false)
  const [confirmOpenEarly, setConfirmOpenEarly] = useState(false)
  const [reasonsDismissed, setReasonsDismissed] = useState(false)

  const idRef = useRef<string | null>(initial?.id ?? null)
  const baseRevRef = useRef(initial?.rev ?? 0)
  const deletingRef = useRef(false)
  const draftRef = useRef<MessageDraft>(draft)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // The refs are only read inside the controller's async callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [controller] = useState(() =>
    createMessageAutosave({
      repos,
      editorKey,
      idRef,
      baseRevRef,
      shadowEnabled,
      onCreated: (id) => {
        setLiveId(id)
        navigate(`/unsent/${id}`, { replace: true, state: { editorKey } })
      },
      onStatus: (next, error) => {
        setStatus(next)
        setStatusError(error ?? null)
        if (error instanceof StorageError && error.kind === 'conflict') setConflict(error.current as UnsentMessage)
        if (error instanceof StorageError && error.kind === 'notFound') setDeletedElsewhere(true)
      },
    }),
  )

  const applyContent = (message: UnsentMessage) => {
    const content = toDraft(message)
    setDraft(content)
    draftRef.current = content
    setTagsText(content.tags.join(', '))
    baseRevRef.current = message.rev
  }

  // Changes made in another tab arrive through the live query (an external system).
  useEffect(() => {
    if (!record || !idRef.current || record.id !== idRef.current || deletingRef.current) return
    const message = record.value
    if (!message) {
      if (!deletedElsewhere) {
        controller.pause()
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to an external (other-tab) deletion
        setDeletedElsewhere(true)
      }
      return
    }
    if (conflict || message.rev === baseRevRef.current || controller.isSaving()) return
    if (controller.hasUnsavedChanges()) {
      controller.pause()
      setConflict(message)
    } else {
      applyContent(message)
    }
  }, [record, status, conflict, controller, deletedElsewhere])

  // A sealed letter whose date has come opens itself once.
  useEffect(() => {
    if (!initial || openedLetter === null) return
    repos.messages
      .unseal(initial.id)
      .then((next) => {
        if (!controller.hasUnsavedChanges()) baseRevRef.current = next.rev
      })
      .catch(() => {})
  }, [initial, openedLetter, repos, controller])

  // Save on the way out: route change, tab hidden, page closing.
  useEffect(() => {
    const unregister = registerFlusher(() => controller.flush())
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void controller.flush()
    }
    const onPageHide = () => void controller.flush()
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!controller.hasUnsavedChanges()) return
      void controller.flush()
      event.preventDefault()
      event.returnValue = ''
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onBeforeUnload)
      unregister()
      void controller.flush().finally(() => {
        controller.dispose()
        // Intentionally the latest id: a new message gets its id after the effect was set up.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        const id = idRef.current
        if (id && !deletingRef.current && !controller.isPaused()) void repos.messages.deleteIfEmpty(id).catch(() => {})
      })
    }
  }, [controller, repos])

  // Grow the textarea with its content.
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 280)}px`
  }, [draft.body])

  const update = (next: MessageDraft) => {
    setDraft(next)
    draftRef.current = next
    controller.change(next)
  }

  const saveAsCopy = async (titleSuffix: string) => {
    const content = draftRef.current
    controller.resume({ discardPending: true })
    deletingRef.current = true
    const title = content.title.trim() ? `${content.title} ${titleSuffix}`.trim() : content.title
    const copy = await repos.messages.create({ ...content, title })
    toast(t('Saved as a separate message.'))
    navigate(`/unsent/${copy.id}`, { replace: true })
  }

  const message = record?.value ?? (liveId ? initial : null)
  const id = liveId
  const readOnly = !!conflict || deletedElsewhere
  const quotaHint =
    statusError instanceof StorageError && statusError.kind === 'quota'
      ? t('Your device storage is full. Export a backup, then delete archived messages to free space.')
      : undefined

  if (message && isSealed(message, today)) {
    return (
      <div>
        <div className="mb-5">
          <Link to="/unsent" className="btn-ghost -ms-3 px-2" aria-label={t('Back')}>
            <Icon name="back" className="size-5 rtl:rotate-180" />
          </Link>
        </div>
        <div className="card text-center">
          <Icon name="lock" className="mx-auto size-8 text-muted" />
          <h1 className="mt-3 font-serif text-2xl">{t('Sealed until {date}', { date: formatLocalDate(message.sealedUntil!, { dateStyle: 'long' }) })}</h1>
          {message.sealedAt && <p className="hint mt-2">{t('You sealed this letter on {date}.', { date: formatTimestamp(message.sealedAt, { dateStyle: 'long' }) })}</p>}
          <p className="hint mt-2">{t('It will open on its own when the day comes.')}</p>
          <button type="button" className="btn-secondary mt-5" onClick={() => setConfirmOpenEarly(true)}>
            {t('Open early')}
          </button>
        </div>
        <ConfirmDialog
          open={confirmOpenEarly}
          title={t('Open this letter early?')}
          confirmLabel={t('Open it')}
          onCancel={() => setConfirmOpenEarly(false)}
          onConfirm={async () => {
            setConfirmOpenEarly(false)
            const next = await repos.messages.unseal(message.id)
            applyContent(next)
          }}
        >
          <p>{t('You chose to wait until {date}. You can still open it now if you want to.', { date: formatLocalDate(message.sealedUntil!) })}</p>
        </ConfirmDialog>
      </div>
    )
  }

  const isArchived = message?.status === 'archived'
  const showReasons = !initial && !id && !reasonsDismissed && !!reasons?.length

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link to="/unsent" className="btn-ghost -ms-3 px-2" aria-label={t('Back to messages')}>
          <Icon name="back" className="size-5 rtl:rotate-180" />
        </Link>
        <div className="min-w-0 flex-1">
          <SaveStatus status={status === 'conflict' ? 'idle' : status} onRetry={() => void controller.retry()} hint={quotaHint} />
        </div>
        {id && message && (
          <div className="flex gap-1">
            <button
              type="button"
              className="btn-ghost px-2.5"
              aria-label={isArchived ? t('Restore from archive') : t('Archive')}
              title={isArchived ? t('Restore from archive') : t('Archive')}
              onClick={async () => {
                await controller.flush()
                const next = await repos.messages.setStatus(id, isArchived ? 'draft' : 'archived')
                baseRevRef.current = next.rev
                toast(isArchived ? t('Restored to drafts.') : t('Moved to the archive.'))
                if (!isArchived) navigate('/unsent')
              }}
            >
              <Icon name={isArchived ? 'restore' : 'archive'} />
            </button>
            {!isArchived && (
              <button type="button" className="btn-ghost px-2.5" aria-label={t('Seal until a date')} title={t('Seal until a date')} onClick={() => setSealOpen(true)}>
                <Icon name="lock" />
              </button>
            )}
            <button
              type="button"
              className="btn-ghost px-2.5"
              aria-label={t('Delete')}
              title={t('Delete')}
              onClick={async () => {
                // Save the latest words first, so Undo brings back exactly what was on screen.
                await controller.flush()
                deletingRef.current = true
                controller.resume({ discardPending: true })
                removeKey('sessionStorage', STORAGE_KEYS.draft(id))
                if (await deleteWithUndo(() => repos.messages.delete(id), t('Message moved to Recently deleted.'))) navigate('/unsent', { replace: true })
                else deletingRef.current = false
              }}
            >
              <Icon name="trash" />
            </button>
          </div>
        )}
      </div>

      {openedLetter !== null && (
        <div className="card mb-4 bg-accent-soft text-sm" role="status">
          {openedLetter
            ? t('You sealed this letter on {date}. Today it opens.', { date: formatTimestamp(openedLetter, { dateStyle: 'long' }) })
            : t('This sealed letter is now open.')}
        </div>
      )}

      {recovered && (
        <div className="card mb-4 border-accent text-sm" role="alert">
          <p>{t('Unsaved text from your last visit was found.')}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                const content = { title: recovered.title, body: recovered.body, tags: recovered.tags }
                setTagsText(content.tags.join(', '))
                update(content)
                setRecovered(null)
              }}
            >
              {t('Restore it')}
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              onClick={() => {
                removeKey('sessionStorage', STORAGE_KEYS.draft(id ?? editorKey))
                setRecovered(null)
              }}
            >
              {t('Discard')}
            </button>
          </div>
        </div>
      )}

      {conflict && (
        <div className="card mb-4 border-danger/50 text-sm" role="alert">
          <p className="font-medium">{t('This message was edited in another tab or window.')}</p>
          <p className="mt-1 text-muted">{t('Your version has not been saved over it. Choose what to keep.')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn-primary btn-sm" onClick={() => void saveAsCopy(t('(copy)'))}>
              {t('Save mine as a copy')}
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                controller.resume({ discardPending: true })
                applyContent(conflict)
                setConflict(null)
              }}
            >
              {t('Load the other version')}
            </button>
          </div>
        </div>
      )}

      {deletedElsewhere && (
        <div className="card mb-4 border-danger/50 text-sm" role="alert">
          <p className="font-medium">{t('This message was deleted in another tab or window.')}</p>
          <button type="button" className="btn-primary btn-sm mt-3" onClick={() => void saveAsCopy('')}>
            {t('Save as a new message')}
          </button>
        </div>
      )}

      {showReasons && (
        <aside className="card mb-4 bg-surface-2 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="section-title">{t('Your reasons')}</p>
            <button type="button" className="btn-ghost btn-sm -me-2 -mt-2 px-2" aria-label={t('Dismiss')} onClick={() => setReasonsDismissed(true)}>
              <Icon name="x" className="size-4" />
            </button>
          </div>
          <ul className="mt-1 space-y-0.5 font-serif text-base text-ink">
            {reasons!.map((reason) => (
              <li key={reason.id}>· {reason.text}</li>
            ))}
          </ul>
        </aside>
      )}

      {/* aria-label rather than a wrapping <label>: a wrapping label would fold the field's own text into its name. */}
      <input
          aria-label={t('Title')}
          className="w-full bg-transparent text-2xl font-semibold text-ink placeholder:text-muted/60 focus:outline-none"
          placeholder={t('Title (optional)')}
          value={draft.title}
          maxLength={500}
          readOnly={readOnly}
          onChange={(e) => update({ ...draft, title: e.target.value })}
        />

      {preferences?.showPrompts && !draft.body && (
        <div className="mt-3">
          <PromptHelper context="message" />
        </div>
      )}

      <textarea
          ref={bodyRef}
          aria-label={t('Message')}
          className="mt-3 block min-h-72 w-full resize-none bg-transparent font-serif text-lg leading-relaxed text-ink placeholder:text-muted/60 focus:outline-none"
          placeholder={t('Write what you need to say. It stays here.')}
          value={draft.body}
          readOnly={readOnly}
          onChange={(e) => update({ ...draft, body: e.target.value })}
          autoFocus={!initial}
          spellCheck
        />

      <label className="mt-6 block border-t border-line pt-4">
        <span className="label">
          {t('Tags')} <span className="font-normal text-muted">({t('optional, separated by commas')})</span>
        </span>
        <input
          className="field"
          value={tagsText}
          readOnly={readOnly}
          onChange={(e) => {
            setTagsText(e.target.value)
            update({ ...draft, tags: parseTags(e.target.value) })
          }}
        />
      </label>

      {message && (
        <p className="hint mt-4 text-xs">
          {t('Written {created} · Edited {updated}', {
            created: formatTimestamp(message.createdAt, { dateStyle: 'medium' }),
            updated: formatTimestamp(message.updatedAt),
          })}
        </p>
      )}


      {sealOpen && (
        <SealDialog
          today={today}
          onClose={() => setSealOpen(false)}
          onSeal={async (until) => {
            if (!id) return
            await controller.flush()
            const next = await repos.messages.seal(id, until)
            baseRevRef.current = next.rev
            setSealOpen(false)
            toast(t('Sealed until {date}.', { date: formatLocalDate(until) }))
            navigate('/unsent')
          }}
        />
      )}
    </div>
  )
}

function SealDialog({ today, onClose, onSeal }: { today: string; onClose: () => void; onSeal: (until: string) => void }) {
  const tomorrow = addDays(today, 1)
  const [date, setDate] = useState(() => addDays(today, 30))
  const valid = isValidLocalDate(date) && daysBetween(tomorrow, date) >= 0
  return (
    <Modal open onClose={onClose} title={t('Seal this letter')}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSeal(date)
        }}
      >
        <p className="text-sm text-muted">
          {t('Choose a day to open it again. Until then, its words are hidden — even from search. Sealing is a promise to yourself, not encryption.')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[7, 30, 90, 365].map((days) => (
            <button key={days} type="button" className={`chip ${date === addDays(today, days) ? 'chip-selected' : ''}`} onClick={() => setDate(addDays(today, days))}>
              {days === 365 ? t('A year') : t('{n} days', { n: days })}
            </button>
          ))}
        </div>
        <label className="mt-4 block">
          <span className="label">{t('Open on')}</span>
          <input type="date" className="field" min={tomorrow} value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t('Cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={!valid}>
            {t('Seal')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
