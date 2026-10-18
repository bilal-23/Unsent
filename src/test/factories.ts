import { createDatabase } from '../db/database'
import { createRepos } from '../repositories'

let counter = 0

/** A fresh, isolated in-memory database for each test. */
export function makeTestRepos() {
  counter += 1
  return createRepos(createDatabase(`unsent-test-${counter}-${Math.random().toString(36).slice(2)}`))
}
