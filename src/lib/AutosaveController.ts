export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

export interface AutosaveOptions<T> {
  /** Persists a full snapshot of the content. Throw to signal failure. */
  save: (value: T) => Promise<void>
  /** Errors for which autosave should stop and wait for the user (e.g. edit conflicts). */
  isConflict?: (error: unknown) => boolean
  onStatus?: (status: AutosaveStatus, error?: unknown) => void
  /** Synchronous safety copy written on every change and cleared after a successful save. */
  shadow?: { write: (value: T) => void; clear: () => void }
  delayMs?: number
  retryDelaysMs?: number[]
}

/**
 * Debounced autosave with one write at a time and no silent loss:
 * - every change replaces the pending snapshot and restarts the debounce
 * - edits made while a write is running are saved right after it
 * - failures keep the content pending and retry with backoff
 * - conflicts pause saving until `resume()` is called
 */
export class AutosaveController<T> {
  private readonly options: Required<Omit<AutosaveOptions<T>, 'shadow' | 'onStatus' | 'isConflict'>> &
    Pick<AutosaveOptions<T>, 'shadow' | 'onStatus' | 'isConflict'>
  private pending: { value: T } | null = null
  private inFlight: Promise<void> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryCount = 0
  private paused = false
  private status: AutosaveStatus = 'idle'

  constructor(options: AutosaveOptions<T>) {
    this.options = { delayMs: 500, retryDelaysMs: [2000, 5000, 15000], ...options }
  }

  get currentStatus(): AutosaveStatus {
    return this.status
  }

  /** True while there is content that has not been confirmed as saved. */
  hasUnsavedChanges(): boolean {
    return this.pending !== null || this.inFlight !== null
  }

  isSaving(): boolean {
    return this.inFlight !== null
  }

  isPaused(): boolean {
    return this.paused
  }

  change(value: T): void {
    this.pending = { value }
    this.options.shadow?.write(value)
    this.clearRetry()
    if (this.paused) return
    this.setStatus('saving')
    this.clearDebounce()
    this.debounceTimer = setTimeout(() => void this.flush(), this.options.delayMs)
  }

  /** Saves pending content now. Resolves once everything pending at call time is written (or failed). */
  flush(): Promise<void> {
    this.clearDebounce()
    if (this.inFlight) return this.inFlight.then(() => this.flush())
    if (this.paused || !this.pending) return Promise.resolve()

    const { value } = this.pending
    this.pending = null
    this.setStatus('saving')

    this.inFlight = this.options
      .save(value)
      .then(
        () => {
          this.retryCount = 0
          if (!this.pending) {
            this.options.shadow?.clear()
            this.setStatus('saved')
          }
        },
        (error: unknown) => {
          // Newer edits supersede this snapshot; otherwise keep it for the retry.
          if (!this.pending) this.pending = { value }
          if (this.options.isConflict?.(error)) {
            this.paused = true
            this.setStatus('conflict', error)
            return
          }
          this.setStatus('error', error)
          this.scheduleRetry()
        },
      )
      .finally(() => {
        this.inFlight = null
      })
    return this.inFlight
  }

  /** Retry immediately (e.g. the user pressed "Retry"). */
  retry(): Promise<void> {
    this.clearRetry()
    this.retryCount = 0
    return this.flush()
  }

  /** Stops saving until resume() — e.g. the record changed in another tab while there are local edits. */
  pause(): void {
    this.paused = true
    this.clearDebounce()
    this.clearRetry()
    this.setStatus('conflict')
  }

  /** Leaves the conflict state. Pass `discardPending` when the user chose the other version. */
  resume({ discardPending = false } = {}): void {
    this.paused = false
    if (discardPending) {
      this.pending = null
      this.options.shadow?.clear()
      this.setStatus('idle')
      return
    }
    if (this.pending) void this.flush()
    else this.setStatus('idle')
  }

  /** Stops timers. Does not save — call flush() first if needed. */
  dispose(): void {
    this.clearDebounce()
    this.clearRetry()
  }

  private scheduleRetry() {
    const delays = this.options.retryDelaysMs
    if (this.retryCount >= delays.length) return
    const delay = delays[this.retryCount++]
    this.retryTimer = setTimeout(() => void this.flush(), delay)
  }

  private clearDebounce() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = null
  }

  private clearRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer)
    this.retryTimer = null
  }

  private setStatus(status: AutosaveStatus, error?: unknown) {
    this.status = status
    this.options.onStatus?.(status, error)
  }
}
