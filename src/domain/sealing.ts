import { daysBetween, isValidLocalDate } from './dates'
import type { LocalDate, UnsentMessage } from './types'

type Sealable = Pick<UnsentMessage, 'sealedUntil'>

/** A message is sealed while today is before its `sealedUntil` date. */
export function isSealed(message: Sealable, today: LocalDate): boolean {
  if (!message.sealedUntil || !isValidLocalDate(message.sealedUntil)) return false
  return daysBetween(today, message.sealedUntil) > 0
}

/** Has a seal date that has now arrived — the letter is ready to be read. */
export function isReadyToOpen(message: Sealable, today: LocalDate): boolean {
  if (!message.sealedUntil || !isValidLocalDate(message.sealedUntil)) return false
  return daysBetween(today, message.sealedUntil) <= 0
}
