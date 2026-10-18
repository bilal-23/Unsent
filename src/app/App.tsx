import { useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router'
import { AppShell } from '../components/AppShell'
import { Toaster } from '../components/Toaster'
import { UpdateBanner } from '../components/UpdateBanner'
import { Home } from '../features/dashboard/Home'
import { CheckInForm } from '../features/journal/CheckInForm'
import { GoodThings } from '../features/journal/GoodThings'
import { JournalLayout } from '../features/journal/JournalLayout'
import { CheckInList } from '../features/journal/CheckInList'
import { Plans } from '../features/journal/Plans'
import { LockGate } from '../features/lock/LockGate'
import { Welcome } from '../features/onboarding/Welcome'
import { Patterns } from '../features/patterns/Patterns'
import { Pause } from '../features/pause/Pause'
import { Privacy } from '../features/privacy/Privacy'
import { ExerciseForm } from '../features/programs/ExerciseForm'
import { ProgramDay } from '../features/programs/ProgramDay'
import { Programs } from '../features/programs/Programs'
import { Settings } from '../features/settings/Settings'
import { Trackers } from '../features/settings/Trackers'
import { MessageEditor } from '../features/unsent/MessageEditor'
import { MessageList } from '../features/unsent/MessageList'
import { UrgeForm } from '../features/urges/UrgeForm'
import { UrgeList } from '../features/urges/UrgeList'
import { usePreferences, useSettings } from '../hooks/useData'
import { useApplyTheme } from '../hooks/useTheme'
import { t } from '../i18n'
import { STORAGE_KEYS, writeJson } from '../lib/storage'
import type { Repos } from '../repositories'
import { Bootstrap } from './Bootstrap'
import { ReposProvider } from './repos'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

function useApplyDisplay(textSize: string | undefined, readingFont: string | undefined) {
  useEffect(() => {
    if (!textSize || !readingFont) return
    const root = document.documentElement
    root.dataset.textSize = textSize
    root.dataset.readingFont = readingFont
    writeJson('localStorage', STORAGE_KEYS.display, { textSize, readingFont })
  }, [textSize, readingFont])
}

/** Sends people without a no-contact setup to onboarding, and away from it once set up. */
function Guarded({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const preferences = usePreferences()
  const location = useLocation()
  useApplyTheme(preferences?.theme)
  useApplyDisplay(preferences?.textSize, preferences?.readingFont)

  if (!settings || !preferences) return null
  const onWelcome = location.pathname === '/welcome'
  if (!settings.value && !onWelcome) return <Navigate to="/welcome" replace />
  if (settings.value && onWelcome) return <Navigate to="/" replace />
  if (onWelcome) return <>{children}</>

  return (
    <AppShell privacyCover={preferences.privacyCover}>
      {children}
    </AppShell>
  )
}

export function AppRoutes() {
  return (
    <Guarded>
      <ScrollToTop />
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/" element={<Home />} />
        <Route path="/unsent" element={<MessageList />} />
        <Route path="/unsent/:id" element={<MessageEditor />} />
        <Route path="/urges" element={<UrgeList />} />
        <Route path="/urges/:id" element={<UrgeForm />} />
        <Route path="/journal" element={<JournalLayout />}>
          <Route index element={<CheckInList />} />
          <Route path="good-things" element={<GoodThings />} />
          <Route path="plans" element={<Plans />} />
        </Route>
        <Route path="/journal/check-in/:date" element={<CheckInForm />} />
        <Route path="/pause" element={<Pause />} />
        <Route path="/patterns" element={<Patterns />} />
        <Route path="/programs" element={<Programs />} />
        <Route path="/programs/:programId/:day" element={<ProgramDay />} />
        <Route path="/exercises/:kind/:id" element={<ExerciseForm />} />
        <Route path="/trackers" element={<Trackers />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Guarded>
  )
}

function NotFound() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{t('Page not found')}</h1>
      <a className="link mt-4 inline-block" href="#/">
        {t('Go home')}
      </a>
    </div>
  )
}

export function App({ repos }: { repos: Repos }) {
  return (
    <>
      <UpdateBanner />
      <AppBody repos={repos} />
    </>
  )
}

function AppBody({ repos }: { repos: Repos }) {
  return (
    <Bootstrap repos={repos}>
      <ReposProvider repos={repos}>
        <LockGate>
          <Toaster>
            <HashRouter>
              <AppRoutes />
            </HashRouter>
          </Toaster>
        </LockGate>
      </ReposProvider>
    </Bootstrap>
  )
}
