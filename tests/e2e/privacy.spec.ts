import { expect, test } from '@playwright/test'
import { onboard, writeMessage, choose } from './helpers'

test('no journal content leaves the device and the CSP is never violated', async ({ page, baseURL }) => {
  const requests: { method: string; url: string; body: string | null }[] = []
  page.on('request', (request) => requests.push({ method: request.method(), url: request.url(), body: request.postData() }))
  const violations: string[] = []
  page.on('console', (message) => {
    if (/Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text())
  })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => console.error(`Refused to load: CSP ${event.violatedDirective}`))
  })

  await onboard(page, { reasons: ['A private reason 7f3a'] })
  await writeMessage(page, { title: 'Private title 7f3a', body: 'Private body 7f3a' })
  await page.goto('/#/urges/new')
  await choose(page.getByRole('radio', { name: '5', exact: true }))
  await page.getByLabel('Anything else').fill('Private note 7f3a')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.goto('/#/settings')
  await page.goto('/#/patterns')

  const origin = new URL(baseURL!).origin
  for (const request of requests) {
    if (request.url.startsWith('data:') || request.url.startsWith('blob:')) continue
    expect(new URL(request.url).origin, request.url).toBe(origin)
    expect(request.method, request.url).toBe('GET')
    expect(request.url).not.toContain('7f3a')
    expect(request.body ?? '').not.toContain('7f3a')
  }
  expect(violations).toEqual([])
})

test('ships a strict Content Security Policy and no third-party scripts', async ({ page }) => {
  await page.goto('/')
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')
  expect(csp).toContain("default-src 'self'")
  expect(csp).toContain("script-src 'self'")
  expect(csp).toContain("connect-src 'self'")
  expect(csp).not.toContain('unsafe-inline')
  const scripts = await page.locator('script[src]').evaluateAll((nodes) => nodes.map((n) => (n as HTMLScriptElement).src))
  for (const src of scripts) expect(new URL(src).origin).toBe(new URL(page.url()).origin)
})
