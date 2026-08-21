// Play test v2: target the real [data-testid="chess-board"] element.
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

await page.goto(BASE + 'play', { waitUntil: 'domcontentloaded' })
await sleep(3000)
// wait for board
await page.waitForSelector('[data-testid="chess-board"]', { timeout: 10000 })
const boardGeo = await page.locator('[data-testid="chess-board"]').boundingBox()
console.log('BOARD GEO:', JSON.stringify(boardGeo))
// engine status?
const initText = await page.evaluate(() => document.body.innerText.slice(0, 300))
console.log('INIT:', JSON.stringify(initText))

const sq = boardGeo.width / 8
// white orientation: e2 -> file e(4), rank2 -> row index from top = 6 (since rank8 at top)
const clickSquare = async (file, rank) => {
  const x = boardGeo.x + file * sq + sq / 2
  const y = boardGeo.y + (8 - rank) * sq + sq / 2
  await page.mouse.click(x, y)
}
// e2e4: file e=4, rank 2; e4 file e=4 rank 4
await clickSquare(4, 2)
await sleep(150)
await clickSquare(4, 4)
console.log('clicked e2-e4')

let responded = false
for (let i = 0; i < 40; i++) {
  await sleep(1000)
  const ml = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="move-list"]')
    return el ? el.innerText : null
  })
  if (ml && /e4|e5|Nf6|c5|d5|d6/.test(ml)) { console.log('ENGINE RESPONDED, move-list:', JSON.stringify(ml.slice(0,120))); responded = true; break }
}
if (!responded) console.log('ENGINE DID NOT RESPOND in 40s; move-list:', JSON.stringify(await page.evaluate(() => document.querySelector('[data-testid="move-list"]')?.innerText || null)))
await sleep(500)
await shot(page, 'play-after-move2')

// Try a couple more moves to confirm engine keeps responding
if (responded) {
  await clickSquare(6, 1) // Ng1-f3
  await sleep(150)
  await clickSquare(6, 3) // to f3
  let r2 = false
  for (let i = 0; i < 30; i++) { await sleep(1000); const ml = await page.evaluate(() => document.querySelector('[data-testid="move-list"]')?.innerText || null); if (ml && ml.split('\n').length > 4) { console.log('after Nf3, move-list:', JSON.stringify(ml.slice(0,150))); r2 = true; break } }
  if (!r2) console.log('engine did not respond to 2nd move')
}
await shot(page, 'play-final')
console.log('--- CONSOLE ERRORS (' + consoleErrors.length + ') ---')
for (const e of consoleErrors.slice(0, 40)) console.log('ERR:', e)
await browser.close()
console.log('DONE')
