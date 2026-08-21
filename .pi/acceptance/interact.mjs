// Exercise Play (engine move), Puzzles (solve), and PGN URL handoff.
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

// ---------- PLAY: make a move and wait for engine reply ----------
await page.goto(BASE + 'play', { waitUntil: 'domcontentloaded' })
await sleep(2500)
// Find the board element to get its geometry
const boardGeo = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="board"], .chess-board, [data-board], svg, canvas') || document.querySelector('div')
  const r = el.getBoundingClientRect()
  return { tag: el.tagName, cls: el.className?.toString?.()?.slice(0,40), x: r.x, y: r.y, w: r.width, h: r.height }
})
console.log('BOARD GEO:', JSON.stringify(boardGeo))

// determine board selector
const boardSel = await page.evaluate(() => {
  const candidates = ['[data-testid="board"]','[data-testid="play-board"]','.chess-board','[data-board]']
  for (const s of candidates) if (document.querySelector(s)) return s
  return null
})
console.log('board selector found:', boardSel)

// Click to play e2-e4 (from e2 to e4). Square coords for white orientation on an 8x board:
// need to find clickable squares. Try clicking based on board geometry.
if (boardGeo && boardGeo.w > 50) {
  const sq = boardGeo.w / 8
  // e2 is file e (index 4), rank 2 (from bottom index 6). For white orientation:
  // x = boardGeo.x + 4*sq + sq/2, y = boardGeo.y + (8-2)*sq + sq/2 = boardGeo.y + 6*sq + sq/2
  const e2x = boardGeo.x + 4*sq + sq/2
  const e2y = boardGeo.y + 6*sq + sq/2
  const e4x = boardGeo.x + 4*sq + sq/2
  const e4y = boardGeo.y + 4*sq + sq/2
  await page.mouse.click(e2x, e2y)
  await sleep(200)
  await page.mouse.click(e4x, e4y)
  console.log('clicked e2-e4')
  // wait for engine to respond
  let moved = false
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    const moveList = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="move-list"], .move-list')
      return el ? el.innerText : null
    })
    if (moveList && moveList.length > 12) { console.log('move-list after engine:', JSON.stringify(moveList.slice(0,100))); moved = true; break }
  }
  if (!moved) console.log('ENGINE DID NOT RESPOND in 30s')
  await sleep(500)
  await shot(page, 'play-after-move')
}

// ---------- PUZZLES: attempt to solve interactively ----------
await page.goto(BASE + 'puzzles', { waitUntil: 'domcontentloaded' })
await sleep(1500)
// get puzzle info
const puzzleInfo = await page.evaluate(() => document.body.innerText.slice(0, 500))
console.log('PUZZLE INFO:', JSON.stringify(puzzleInfo))
// Try clicking "Show Solution"
try {
  await page.click('text=Show Solution', { timeout: 3000 })
  await sleep(1000)
  await shot(page, 'puzzles-solved')
  const after = await page.evaluate(() => document.body.innerText.slice(0, 800))
  console.log('AFTER SOLUTION:', JSON.stringify(after))
} catch (e) { console.log('show solution err', e.message) }

// ---------- PGN URL handoff ----------
const pgn = `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1/2-1/2`
const url = BASE + 'analyze?pgn=' + encodeURIComponent(pgn)
await page.goto(url, { waitUntil: 'domcontentloaded' })
await sleep(2000)
await shot(page, 'analyze-url-handoff')
const handoffText = await page.evaluate(() => {
  const err = document.querySelector('[data-testid="analyze-error"]')
  const mv = document.querySelector('[data-testid="move-list"]')
  const an = document.querySelector('[data-testid="analyzing"]')
  return { err: err?.innerText || null, moves: mv?.innerText?.slice(0,200) || null, analyzing: an?.innerText || null }
})
console.log('URL HANDOFF:', JSON.stringify(handoffText))

console.log('--- CONSOLE ERRORS (' + consoleErrors.length + ') ---')
for (const e of consoleErrors.slice(0, 40)) console.log('ERR:', e)
await browser.close()
console.log('DONE')
