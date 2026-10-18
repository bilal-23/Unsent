import { NavLink, Outlet } from 'react-router'
import { PageHeader } from '../../components/PageHeader'
import { t } from '../../i18n'

const TABS = [
  { to: '/journal', label: 'Check-ins', end: true },
  { to: '/journal/good-things', label: 'Good things' },
  { to: '/journal/plans', label: 'Plans' },
]

export function JournalLayout() {
  return (
    <div>
      <PageHeader title={t('Journal')} />
      <nav aria-label={t('Journal sections')} className="mb-5 flex gap-1 rounded-xl bg-surface-2 p-1">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `flex min-h-10 flex-1 items-center justify-center rounded-lg px-2 text-sm font-medium ${isActive ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`
            }
          >
            {t(tab.label)}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
