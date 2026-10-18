import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { t } from '../i18n'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  /** When set, the user must type this word to enable the confirm button. */
  requireText?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** Accessible modal built on <dialog>: focus is trapped and Esc cancels. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = t('Cancel'),
  danger,
  requireText,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [typed, setTyped] = useState('')

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      setTyped('')
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  const canConfirm = !busy && (!requireText || typed.trim().toUpperCase() === requireText.toUpperCase())

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 shadow-xl"
      onCancel={(event) => {
        event.preventDefault()
        onCancel()
      }}
    >
      <form
        method="dialog"
        className="p-5"
        onSubmit={(event) => {
          event.preventDefault()
          if (canConfirm) onConfirm()
        }}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        {children && <div className="mt-2 space-y-2 text-sm text-muted">{children}</div>}
        {requireText && (
          <label className="mt-4 block">
            <span className="label">{t('Type {word} to confirm', { word: requireText })}</span>
            <input className="field" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" />
          </label>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="submit" className={danger ? 'btn-danger' : 'btn-primary'} disabled={!canConfirm}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  )
}
