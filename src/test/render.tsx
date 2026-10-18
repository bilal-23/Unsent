import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '../app/App'
import { ReposProvider } from '../app/repos'
import { Toaster } from '../components/Toaster'
import { LockGate } from '../features/lock/LockGate'
import type { Repos } from '../repositories'
import { makeTestRepos } from './factories'

export async function openTestRepos(): Promise<Repos> {
  const repos = makeTestRepos()
  await repos.connection.open()
  await repos.lock.init()
  return repos
}

/** Renders the real routes at `path` against an isolated database. */
export function renderApp(repos: Repos, path: string) {
  const user = userEvent.setup()
  const utils = render(
    <ReposProvider repos={repos}>
      <LockGate>
        <Toaster>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </Toaster>
      </LockGate>
    </ReposProvider>,
  )
  return { user, ...utils }
}
