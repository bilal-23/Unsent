import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export interface ToastAction {
  label: string
  onAction: () => void
}

interface Toast {
  id: number
  message: string
  action?: ToastAction
}

type ShowToast = (message: string, options?: { action?: ToastAction }) => void

const ToastContext = createContext<ShowToast>(() => {})

const PLAIN_MS = 3500
/** Toasts with an action (Undo) stay longer so there is time to reach the button. */
const ACTION_MS = 8000

/** Brief confirmations announced politely to screen readers. Never include journal content. */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const show = useCallback<ShowToast>(
    (message, options) => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-2), { id, message, action: options?.action }])
      setTimeout(() => dismiss(id), options?.action ? ACTION_MS : PLAIN_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => show, [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto flex items-center gap-3 rounded-xl bg-ink py-2.5 ps-4 pe-2 text-sm text-bg shadow-lg">
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="min-h-9 rounded-lg px-3 font-semibold text-bg underline underline-offset-4 hover:bg-bg/10"
                onClick={() => {
                  dismiss(toast.id)
                  toast.action!.onAction()
                }}
              >
                {toast.action.label}
              </button>
            )}
            {!toast.action && <span className="pe-2" />}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  return useContext(ToastContext)
}
