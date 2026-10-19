import { weekSummaryKind, type WeekProgress } from '../../domain/habits'
import { t } from '../../i18n'

/** Plain-language weekly summary: met, on its way, or a fresh start — never "failed". */
export function weekSummaryText(progress: WeekProgress): string {
  switch (weekSummaryKind(progress)) {
    case 'met':
      return t('Weekly goal met: {done} of {target}', { done: progress.done, target: progress.target })
    case 'onTrack':
      return t('This week: {done} of {target}', { done: progress.done, target: progress.target })
    case 'fresh':
      return t('This week: 0 of {target} — a fresh start', { target: progress.target })
  }
}
