import { useState } from 'react'
import { useRepos } from '../../app/repos'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/Toaster'
import { t } from '../../i18n'
import { IntentionPicker } from './IntentionPicker'

export function IntentionDialog({ open, current, onClose }: { open: boolean; current: number | undefined; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={t('Your intention')}>
      <IntentionForm current={current} onClose={onClose} />
    </Modal>
  )
}

/** Mounted fresh each time the dialog opens (Modal renders children only while open). */
function IntentionForm({ current, onClose }: { current: number | undefined; onClose: () => void }) {
  const repos = useRepos()
  const toast = useToast()
  const [value, setValue] = useState(current)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        try {
          await repos.tracking.setIntention(value)
          toast(value ? t('Intention saved.') : t('Intention cleared.'))
          onClose()
        } catch {
          toast(t('Something went wrong. Please try again.'))
        }
      }}
    >
      <IntentionPicker value={value} onChange={setValue} />
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('Cancel')}
        </button>
        <button type="submit" className="btn-primary">
          {t('Save')}
        </button>
      </div>
    </form>
  )
}
