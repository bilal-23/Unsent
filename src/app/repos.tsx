import { createContext, useContext, type ReactNode } from 'react'
import type { Repos } from '../repositories'

const ReposContext = createContext<Repos | null>(null)

export function ReposProvider({ repos, children }: { repos: Repos; children: ReactNode }) {
  return <ReposContext.Provider value={repos}>{children}</ReposContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRepos(): Repos {
  const repos = useContext(ReposContext)
  if (!repos) throw new Error('useRepos must be used inside <ReposProvider>')
  return repos
}
