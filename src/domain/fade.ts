import type { IntentionStatus, NoContactStatus } from './dates'

/**
 * How much Home focuses on the no-contact counter versus the user's own life.
 * - early: the counter leads (first two weeks)
 * - settling: life leads, counter is a smaller card (two weeks on, or once an intention is reached)
 * - living: the counter is a quiet line (60+ days)
 */
export type FadeStage = 'early' | 'settling' | 'living'

export const SETTLING_AFTER_DAYS = 14
export const LIVING_AFTER_DAYS = 60

export function fadeStage(status: NoContactStatus, intention: IntentionStatus, fadeMode: boolean): FadeStage {
  if (!fadeMode || status.kind !== 'ok') return 'early'
  if (status.days >= LIVING_AFTER_DAYS) return 'living'
  if (status.days >= SETTLING_AFTER_DAYS || intention.kind === 'reached') return 'settling'
  return 'early'
}
