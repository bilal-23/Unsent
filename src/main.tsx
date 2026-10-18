import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { setLocale } from './i18n'
import { createRepos } from './repositories'
import './styles.css'

setLocale()

const repos = createRepos()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App repos={repos} />
    </ErrorBoundary>
  </StrictMode>,
)
