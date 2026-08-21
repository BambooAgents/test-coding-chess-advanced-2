import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const PUZZLES_URL = BASE + 'puzzles'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

page.on('console', msg => console.log('[browser console]', msg.type(), msg.text()))
page.on('pageerror', err => console.log('[pageerror]', err.message))

await page.goto(PUZZLES_URL)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1500)

const probe = await page.evaluate(() => {
  return {
    url: location.href,
    hash: location.hash,
    title: document.title,
    bodyTextStart: document.body.innerText.slice(0, 2000),
    boardCount: document.querySelectorAll('[data-testid="chess-board"]').length,
    squareCount: document.querySelectorAll('[data-square]').length,
    pieceCount: document.querySelectorAll('[data-square] img').length,
    dataTestids: Array.from(document.querySelectorAll('[data-testid]')).map(e => e.getAttribute('data-testid')).slice(0, 30),
    // dump first 3 squares
    firstSquares: Array.from(document.querySelectorAll('[data-square]')).slice(0, 5).map(e => ({
      sq: e.getAttribute('data-square'),
      hasImg: !!e.querySelector('img'),
      alt: e.querySelector('img')?.getAttribute('alt'),
    })),
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).slice(0, 30),
    h1: document.querySelector('h1, h2')?.textContent,
  }
})
console.log(JSON.stringify(probe, null, 2))
writeFileSync('.pi/acceptance/swarm4/debug-step1.json', JSON.stringify(probe, null, 2))
await page.screenshot({ path: '.pi/acceptance/swarm4/screenshots/debug-step1.png', fullPage: true })
await browser.close()
