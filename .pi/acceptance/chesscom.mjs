// Test chess.com import live on Analyze + Weaknesses pages with a real username.
import { chromium } from '@playwright/test'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const OUT = '.pi/acceptance/screenshots/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function shot(page, name) { const path = OUT + name + '.png'; await page.screenshot({ path, fullPage: true }); console.log('SHOT', path); }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

// ---------- ANALYZE chess.com import ----------
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' })
await sleep(1500)
// Use a real username known to have games. Use 'hikaru'.
await page.fill('[data-testid="username-input"]', 'hikaru')
await page.click('[data-testid="load-games"]')
console.log('clicked load games')
let loaded = false
for (let i = 0; i < 45; i++) {
  await sleep(1000)
  const state = await page.evaluate(() => {
    const err = document.querySelector('[data-testid="analyze-error"]')
    const ml = document.querySelector('[data-testid="move-list"]')
    const an = document.querySelector('[data-testid="analyzing"]')
    const sel = document.querySelector('select')
    return { err: err?.innerText || null, moves: ml?.innerText?.slice(0,80) || null, analyzing: an?.innerText || null }
  })
  if (state.err) { console.log('analyze chesscom error:', state.err); break }
  if (state.moves || state.analyzing) { console.log('analyze chesscom loaded; analyzing:', state.analyzing, 'moves:', state.moves); loaded = true; break }
}
await sleep(2000)
await shot(page, 'analyze-chesscom')
const state2 = await page.evaluate(() => {
  const err = document.querySelector('[data-testid="analyze-error"]')
  const ml = document.querySelector('[data-testid="move-list"]')
  const an = document.querySelector('[data-testid="analyzing"]')
  return { err: err?.innerText || null, moves: ml?.innerText?.slice(0,150) || null, analyzing: an?.innerText || null }
})
console.log('analyze-chesscom final:', JSON.stringify(state2))

// ---------- WEAKNESSES chess.com import ----------
await page.goto(BASE + 'weaknesses', { waitUntil: 'domcontentloaded' })
await sleep(1500)
const weakDom = await page.evaluate(() => {
  const inputs = Array.from(document.querySelectorAll('input')).map(i=>({type:i.type,placeholder:i.placeholder,testid:i.dataset?.testid}))
  return inputs
})
console.log('weaknesses inputs:', JSON.stringify(weakDom))
// fill username input
try {
  await page.fill('input', 'hikaru')
  // find the Analyze button
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b=>b.innerText))
  console.log('weaknesses buttons:', JSON.stringify(btns))
  // click the Analyze button (text)
  await page.click('button:has-text("Analyze")', { timeout: 3000 })
} catch (e) { console.log('weaknesses interact err:', e.message) }
let weakLoaded = false
for (let i = 0; i < 60; i++) {
  await sleep(1000)
  const t = await page.evaluate(() => document.body.innerText.slice(0, 800))
  if (/weak|opening|endgame|report|accuracy|blunder|mistake/i.test(t) && t.length > 350) {
    console.log('WEAKNESSES produced report at', i, 's; text:\n', t.slice(0, 800))
    weakLoaded = true
    break
  }
  if (t.includes('No games') || /error/i.test(t)) { console.log('weaknesses msg:', t.slice(0,300)); break }
}
await sleep(1000)
await shot(page, 'weaknesses-report')
const finalWeak = await page.evaluate(() => document.body.innerText.slice(0, 1000))
console.log('WEAKNESSES FINAL:\n', finalWeak)

console.log('--- CONSOLE ERRORS (' + consoleErrors.length + ') ---')
for (const e of consoleErrors.slice(0, 40)) console.log('ERR:', e)
await browser.close()
console.log('DONE')
