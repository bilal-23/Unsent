import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutosaveController, type AutosaveStatus } from './AutosaveController'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function setup(save: (value: string) => Promise<void>, isConflict?: (error: unknown) => boolean) {
  const statuses: AutosaveStatus[] = []
  const shadow = { write: vi.fn(), clear: vi.fn() }
  const controller = new AutosaveController<string>({ save, isConflict, shadow, onStatus: (s) => statuses.push(s) })
  return { controller, statuses, shadow }
}

describe('AutosaveController', () => {
  it('debounces rapid changes into one save of the latest text', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { controller, statuses, shadow } = setup(save)
    controller.change('a')
    controller.change('ab')
    controller.change('abc')
    expect(shadow.write).toHaveBeenLastCalledWith('abc')
    await vi.advanceTimersByTimeAsync(499)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('abc')
    expect(statuses.at(-1)).toBe('saved')
    expect(shadow.clear).toHaveBeenCalled()
  })

  it('saves edits made during a write right after it, without overlapping writes', async () => {
    let release!: () => void
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((r) => (release = r))).mockResolvedValue(undefined)
    const { controller } = setup(save)
    controller.change('first')
    await vi.advanceTimersByTimeAsync(500)
    controller.change('second')
    const flushed = controller.flush()
    expect(save).toHaveBeenCalledTimes(1)
    release()
    await flushed
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('second')
    expect(controller.hasUnsavedChanges()).toBe(false)
  })

  it('keeps text after a failed save and retries with backoff', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined)
    const { controller, statuses, shadow } = setup(save)
    controller.change('precious words')
    await vi.advanceTimersByTimeAsync(500)
    expect(statuses.at(-1)).toBe('error')
    expect(controller.hasUnsavedChanges()).toBe(true)
    expect(shadow.clear).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2000)
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenLastCalledWith('precious words')
    expect(statuses.at(-1)).toBe('saved')
  })

  it('pauses on a conflict and only continues when told to', async () => {
    const conflict = new Error('conflict')
    const save = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValue(undefined)
    const { controller, statuses } = setup(save, (e) => e === conflict)
    controller.change('mine')
    await vi.advanceTimersByTimeAsync(500)
    expect(statuses.at(-1)).toBe('conflict')
    controller.change('more of mine')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(save).toHaveBeenCalledTimes(1)
    controller.resume({ discardPending: true })
    expect(controller.hasUnsavedChanges()).toBe(false)
  })

  it('flushes immediately on demand (leaving the editor)', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { controller } = setup(save)
    controller.change('bye')
    await controller.flush()
    expect(save).toHaveBeenCalledWith('bye')
  })
})
