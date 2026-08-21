import { chromium } from 'playwright'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
page.on('console', msg => console.log('CONSOLE:', msg.type(), msg.text().slice(0,150)))
page.on('pageerror', e => console.log('PAGEERROR:', e.message.slice(0,200)))
await page.goto(BASE + '#/analyze', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
const html = await page.evaluate(() => document.body.innerHTML.slice(0, 800))
console.log('BODY:', html)
const hasInput = await page.locator('[data-testid="pgn-input"]').count()
console.log('pgn-input count:', hasInput)
await browser.close()
