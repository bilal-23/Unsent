import { NavLink, Outlet, useLocation } from 'react-router'
import { HelpButton, HelpNote } from '../../components/HelpNote'
import type { HelpId } from '../../domain/help'
import { PageHeader } from '../../components/PageHeader'
import { SearchButton } from '../../components/SearchButton'
import { t } from '../../i18n'

const TABS = [
  { to: '/journal', label: 'Check-ins', end: true },
  { to: '/journal/good-things', label: 'Good things' },
  { to: '/journal/habits', label: 'Habits' },
  { to: '/journal/plans', label: 'Plans' },
]

const TAB_HELP: Record<string, HelpId> = {
  '/journal': 'checkins',
  '/journal/good-things': 'goodThings',
  '/journal/habits': 'habits',
  '/journal/plans': 'plans',
}

export function JournalLayout() {
  const { pathname } = useLocation()
  const helpId = TAB_HELP[pathname.replace(/\/$/, '')] ?? 'checkins'
  return (
    <div>
      <PageHeader
        title={t('Journal')}
        actions={
          <>
            <HelpButton id={helpId} />
            <SearchButton />
          </>
        }
      />
      <nav aria-label={t('Journal sections')} className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-10 min-w-0 flex-1 items-center justify-center rounded-lg px-1 text-[0.8125rem] font-medium whitespace-nowrap sm:text-sm ${isActive ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`
            }
          >
            {t(tab.label)}
          </NavLink>
        ))}
      </nav>
      <HelpNote id={helpId} />
      <Outlet />
    </div>
  )
}
