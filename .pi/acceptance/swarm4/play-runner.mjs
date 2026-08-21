// Play acceptance runner — executes the play-16.md user-story script.
import { chromium } from 'playwright'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'
const SHOT = '.pi/acceptance/swarm4/screenshots'
const LOG = []

function log(s) { console.log(s); LOG.push(s) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE-ERR:', m.text()) })
page.on('pageerror', e => console.log('PAGEERROR:', e.message))

const probes = {}

async function shot(name) {
  await page.screenshot({ path: `${SHOT}/${name}.png`, fullPage: true })
  log(`SHOT ${name}`)
}

// ---------- Step 1: Navigate to /play ----------
log('=== STEP 1: Navigate to /play ===')
await page.goto(`${BASE}/play`); await page.waitForSelector("[data-testid=\"chess-board\"]", { timeout: 15000 })
await page.waitForTimeout(1500)
await shot('play-step1')

probes.step1 = await page.evaluate(() => {
  const board = document.querySelector('[data-testid="chess-board"]')
  const newGame = document.querySelector('[data-testid="new-game-btn"]')
  const strength = document.querySelector('[data-testid="strength-select"]')
  const status = document.querySelector('[data-testid="play-status"]')
  const pieces = board ? board.querySelectorAll('img') : []
  const squares = board ? board.querySelectorAll('[data-square]') : []
  const b = board?.getBoundingClientRect()
  const ng = newGame?.getBoundingClientRect()
  // spatial: board vs controls overlap check
  const overlap = (b && ng) ? !(ng.x > b.right || ng.x+ng.width < b.x) : null
  return {
    boardExists: !!board,
    squareCount: squares.length,
    pieceCount: pieces.length,
    newGameExists: !!newGame,
    newGameText: newGame?.textContent,
    strengthExists: !!strength,
    strengthValue: strength?.value,
    strengthOptions: strength ? Array.from(strength.options).map(o=>o.textContent) : null,
    statusText: status?.textContent,
    boardRect: b ? {x:b.x,y:b.y,w:b.width,h:b.height} : null,
    newGameRect: ng ? {x:ng.x,y:ng.y,w:ng.width,h:ng.height} : null,
    controlsOverlap: overlap,
  }
})
log('STEP1 probe: ' + JSON.stringify(probes.step1))

// ---------- Step 2: Start a game vs Easy engine ----------
log('=== STEP 2: New Game (Easy) ===')
// set strength to Easy
await page.selectOption('[data-testid="strength-select"]', 'Easy')
await page.waitForTimeout(200)
await page.click('[data-testid="new-game-btn"]')
await page.waitForTimeout(800)
await shot('play-step2')

probes.step2 = await page.evaluate(() => {
  const status = document.querySelector('[data-testid="play-status"]')
  // Click a piece to see legal-move highlights
  const e2 = document.querySelector('[data-square="e2"]')
  return {
    statusText: status?.textContent,
    e2Exists: !!e2,
  }
})
log('STEP2 probe: ' + JSON.stringify(probes.step2))

// Click e2 pawn to trigger legal-move highlights, screenshot
await page.click('[data-square="e2"]')
await page.waitForTimeout(300)
await shot('play-step2b')

probes.step2b = await page.evaluate(() => {
  const board = document.querySelector('[data-testid="chess-board"]')
  const squares = board ? Array.from(board.querySelectorAll('[data-square]')) : []
  // legal-move squares have an ::after with opacity>0; we can't read pseudo via DOM easily,
  // but we can check which squares are styled as selected via computed style on selected square
  // Instead, count squares whose ::after is visible by checking class — but styles are via styled-components props.
  // We'll detect selected square by background color check.
  let selected = []
  for (const sq of squares) {
    const bg = getComputedStyle(sq).background
    if (bg && bg.includes('257, 257')) selected.push(sq.getAttribute('data-square')) // accent-soft approx
  }
  // Better: look for the square that has the selected style; check e2 specifically
  const e2 = board.querySelector('[data-square="e2"]')
  const e2bg = e2 ? getComputedStyle(e2).backgroundColor : null
  const e4 = board.querySelector('[data-square="e4"]')
  const e4after = e4 ? getComputedStyle(e4, '::after').opacity : null
  return {
    e2bg,
    e4afterOpacity: e4after,
    selectedCount: selected.length,
  }
})
log('STEP2b probe (legal highlights): ' + JSON.stringify(probes.step2b))

// ---------- Step 3: Play 1.e4, engine responds ----------
log('=== STEP 3: Play 1.e4 ===')
// e2 already selected; click e4
await page.click('[data-square="e4"]')
await page.waitForTimeout(500)
// FEN right after player move
probes.step3a = await page.evaluate(() => {
  const status = document.querySelector('[data-testid="play-status"]')
  return { statusText: status?.textContent }
})
log('STEP3a (after player e4): ' + JSON.stringify(probes.step3a))
await shot('play-step3a')

// Wait for engine to move — poll status text for "Your move" or move list grows
let moved = false
const t0 = Date.now()
let fenAfter = null
let engineMoveText = null
while (Date.now() - t0 < 8000) {
  await page.waitForTimeout(400)
  const st = await page.evaluate(() => {
    const status = document.querySelector('[data-testid="play-status"]')
    const ml = document.querySelector('[data-testid="move-list"]')
    return { status: status?.textContent, moves: ml?.textContent?.trim() }
  })
  if (st.status && st.status.toLowerCase().includes('your move')) {
    moved = true
    engineMoveText = st.moves
    break
  }
  // also accept "Stockfish is thinking" as intermediate
}
log('STEP3 engine moved: ' + moved + ' after ' + (Date.now()-t0) + 'ms, moves=' + engineMoveText)
await shot('play-step3b')

probes.step3 = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]')
  const status = document.querySelector('[data-testid="play-status"]')
  const squares = Array.from(document.querySelectorAll('[data-square]'))
  const fen = null
  return {
    moveListText: ml?.textContent?.trim(),
    statusText: status?.textContent,
    moveListLen: ml?.textContent?.trim().split(/\s+/).filter(Boolean).length,
  }
})
log('STEP3 probe: ' + JSON.stringify(probes.step3))

// ---------- Step 4: Illegal move rejected ----------
log('=== STEP 4: Illegal move ===')
// After 1.e4 + engine reply, it's our move. Try moving e4 pawn backwards to e2 (illegal for a pawn that already moved to e4? Actually e2 is behind, pawns can't go back).
// First we need to know whose move it is. The status should say "Your move".
// Click a pawn and try an illegal target. E.g., click a2 then a5 (pawn 3-square only from start; a2 pawn already... a2 hasn't moved, a2-a5 illegal because only 2-square from start)
// Actually a2-a3/a4 legal. Let's try moving a knight illegally: click b1 knight, click b3 (illegal knight move).
const st4 = await page.evaluate(() => document.querySelector('[data-testid="play-status"]')?.textContent)
log('STEP4 status before illegal: ' + st4)
await page.click('[data-square="b1"]')
await page.waitForTimeout(200)
await page.click('[data-square="b3"]') // illegal knight move
await page.waitForTimeout(600)
await shot('play-step4')

probes.step4 = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]')
  const toast = document.querySelector('div[style*="opacity"]') // toast
  // get toast text — toast is the last styled div with the message
  const allDivs = Array.from(document.querySelectorAll('div'))
  let toastText = null
  for (const d of allDivs) {
    const t = d.textContent?.trim()
    if (t === 'Illegal move') { toastText = t; break }
  }
  return {
    moveListText: ml?.textContent?.trim(),
    moveListLen: ml?.textContent?.trim().split(/\s+/).filter(Boolean).length,
    illegalToastSeen: toastText === 'Illegal move',
  }
})
log('STEP4 probe: ' + JSON.stringify(probes.step4))

// ---------- Step 5: Take-back ----------
log('=== STEP 5: Take-back ===')
const beforeTakeback = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]')
  return { moves: ml?.textContent?.trim(), len: ml?.textContent?.trim().split(/\s+/).filter(Boolean).length }
})
log('STEP5 before takeback: ' + JSON.stringify(beforeTakeback))
await page.click('[data-testid="takeback-btn"]')
await page.waitForTimeout(500)
await shot('play-step5')

probes.step5 = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]')
  const status = document.querySelector('[data-testid="play-status"]')
  return {
    moves: ml?.textContent?.trim(),
    len: ml?.textContent?.trim().split(/\s+/).filter(Boolean).length,
    statusText: status?.textContent,
  }
})
log('STEP5 after takeback: ' + JSON.stringify(probes.step5))

// ---------- Step 6: Resign + New Game ----------
log('=== STEP 6: Resign + New Game ===')
await page.click('[data-testid="resign-btn"]')
await page.waitForTimeout(700)
await shot('play-step6a')
probes.step6a = await page.evaluate(() => {
  const status = document.querySelector('[data-testid="play-status"]')
  const resign = document.querySelector('[data-testid="resign-btn"]')
  return { statusText: status?.textContent, resignDisabled: resign?.disabled }
})
log('STEP6a (resign): ' + JSON.stringify(probes.step6a))

await page.click('[data-testid="new-game-btn"]')
await page.waitForTimeout(700)
await shot('play-step6b')
probes.step6b = await page.evaluate(() => {
  const status = document.querySelector('[data-testid="play-status"]')
  const ml = document.querySelector('[data-testid="move-list"]')
  return { statusText: status?.textContent, moveListText: ml?.textContent?.trim() }
})
log('STEP6b (new game): ' + JSON.stringify(probes.step6b))

// ---------- Step 7: Analyze-handoff ----------
log('=== STEP 7: Analyze-handoff ===')
// Need a few moves first. Play a quick sequence.
await page.click('[data-square="e2"]')
await page.waitForTimeout(150)
await page.click('[data-square="e4"]')
await page.waitForTimeout(2500) // engine move
await page.click('[data-square="d2"]')
await page.waitForTimeout(150)
await page.click('[data-square="d4"]')
await page.waitForTimeout(2500)
const preAnalyze = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]')
  return { moves: ml?.textContent?.trim() }
})
log('STEP7 pre-analyze moves: ' + JSON.stringify(preAnalyze))

await page.click('[data-testid="analyze-btn"]')
await page.waitForTimeout(2000)
await shot('play-step7')

probes.step7 = await page.evaluate(() => {
  const url = location.hash
  const pgnArea = document.querySelector('textarea')
  const moveList = document.querySelector('[data-testid="move-list"]')
  // try to find any pgn-related input
  return {
    hash: url,
    pgnTextareaExists: !!pgnArea,
    pgnValue: pgnArea?.value,
    moveListText: moveList?.textContent?.trim(),
    moveListLen: moveList?.textContent?.trim().split(/\s+/).filter(Boolean).length,
  }
})
log('STEP7 probe: ' + JSON.stringify(probes.step7))

// ---------- Engine variation check (product-truth gate) ----------
log('=== ENGINE VARIATION CHECK ===')
// Navigate fresh, set Easy, and play e4 several times in new games to see if engine varies.
await page.goto(`${BASE}/play`); await page.waitForSelector("[data-testid=\"chess-board\"]", { timeout: 15000 })
await page.waitForTimeout(1500)
await page.selectOption('[data-testid="strength-select"]', 'Easy')
const replies = []
for (let i = 0; i < 4; i++) {
  await page.click('[data-testid="new-game-btn"]')
  await page.waitForTimeout(500)
  await page.click('[data-square="e2"]')
  await page.waitForTimeout(150)
  await page.click('[data-square="e4"]')
  // wait for engine reply
  let mv = null
  const t1 = Date.now()
  while (Date.now() - t1 < 6000) {
    await page.waitForTimeout(300)
    const st = await page.evaluate(() => {
      const ml = document.querySelector('[data-testid="move-list"]')
      return ml?.textContent?.trim()
    })
    if (st && st.split(/\s+/).filter(Boolean).length >= 2) { mv = st; break }
  }
  // parse the 2nd token (black's move)
  const tokens = (mv||'').split(/\s+/).filter(Boolean)
  replies.push(tokens.length >= 2 ? tokens.slice(0,4).join(' ') : mv)
  log('ENGINE trial ' + i + ': ' + mv)
}
probes.engineVariation = { replies, unique: [...new Set(replies)].length }
log('ENGINE VARIATION: ' + JSON.stringify(probes.engineVariation))

// ---------- Write probes ----------
const fs = await import('fs')
fs.writeFileSync('.pi/acceptance/swarm4/probes.json', JSON.stringify(probes, null, 2))
fs.writeFileSync('.pi/acceptance/swarm4/runner.log', LOG.join('\n'))

await browser.close()
log('DONE')
