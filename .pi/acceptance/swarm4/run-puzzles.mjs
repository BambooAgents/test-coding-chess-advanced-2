// Acceptance driver v3 — final swarm4 puzzles story.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const PUZZLES_URL = BASE + 'puzzles'
const SCREEN_DIR = '.pi/acceptance/swarm4/screenshots'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const puzzleJson = JSON.parse(readFileSync('src/data/puzzles.json', 'utf8'))
const fenToPuzzle = new Map()
for (const p of puzzleJson) fenToPuzzle.set(p.fen.split(' ')[0], p)
function findPuzzle(placement) { return fenToPuzzle.get(placement) || null }
function log(m) { console.log('[acceptance]', m) }

async function getBoardPlacement(page) {
  return await page.evaluate(() => {
    const board = document.querySelector('[data-testid="chess-board"]')
    if (!board) return null
    const map = {}
    for (const sq of board.querySelectorAll('[data-square]'))
      map[sq.getAttribute('data-square')] = sq.querySelector('img')?.getAttribute('alt') || null
    const files = 'abcdefgh'
    let placement = ''
    for (let r = 8; r >= 1; r--) {
      let s = '', e = 0
      for (let f = 0; f < 8; f++) {
        const code = map[files[f] + r]
        if (!code) { e++ }
        else { if (e > 0) { s += e; e = 0 }; s += code[0] === 'w' ? code[1].toUpperCase() : code[1].toLowerCase() }
      }
      if (e > 0) s += e
      placement += (placement ? '/' : '') + s
    }
    return placement
  })
}

// Read the feedback banner precisely (styled feedback area, not stats).
async function getFeedback(page) {
  return await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div'))
    const matches = all.filter(e => {
      const t = e.textContent?.trim()
      return t && /to move — find the best move|Correct!|Wrong move|Puzzle solved/i.test(t) && t.length < 80
    }).map(e => e.textContent.trim())
    return matches[0] || null
  })
}

async function getInfo(page) {
  return await page.evaluate(() => {
    const body = document.body.innerText
    const ratingMatch = body.match(/Rating\s*\n?\s*(\d+)/)
    const puzzleNumMatch = body.match(/Puzzle\s*#\s*\n?\s*(\d+)\s*\/\s*(\d+)/)
    const themesMatch = body.match(/Themes\s*\n?\s*([^\n]+)/)
    return {
      rating: ratingMatch ? ratingMatch[1] : null,
      puzzleNum: puzzleNumMatch ? `${puzzleNumMatch[1]}/${puzzleNumMatch[2]}` : null,
      themes: themesMatch ? themesMatch[1].trim() : null,
      sampleOrTestIdVisible: /sample-|test-/i.test(body),
    }
  })
}

async function playMove(page, from, to) {
  await page.click(`[data-square="${from}"]`); await page.waitForTimeout(120)
  await page.click(`[data-square="${to}"]`); await page.waitForTimeout(400)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const results = { steps: [] }
const record = (step, data) => results.steps.push({ step, ...data })

// ---------- STEP 1: Plain puzzle loads ----------
log('=== STEP 1 ===')
await page.goto(PUZZLES_URL)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1200)
const p1 = await getBoardPlacement(page)
const puzzle1 = findPuzzle(p1)
const info1 = await getInfo(page)
const feedback1 = await getFeedback(page)
const boardProbe1 = await page.evaluate(() => {
  const board = document.querySelector('[data-testid="chess-board"]')
  const svg = document.querySelector('[data-testid="board-arrows"]')
  if (!board) return { error: 'no board' }
  const b = board.getBoundingClientRect()
  const s = svg ? svg.getBoundingClientRect() : null
  return {
    squareCount: board.querySelectorAll('[data-square]').length,
    pieceCount: board.querySelectorAll('[data-square] img').length,
    boardRect: { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom },
    arrowsSvg: s ? { x: s.x, y: s.y, w: s.width, h: s.height } : null,
    arrowsContained: s ? (s.x >= b.x && s.y >= b.y && s.right <= b.right && s.bottom <= b.bottom) : null,
  }
})
record(1, {
  placement: p1, matchedPuzzleId: puzzle1?.id, matchedFen: puzzle1?.fen,
  isStartingPosition: puzzle1 ? (puzzle1.fen === START_FEN || p1 === START_FEN.split(' ')[0]) : null,
  isSampleTestId: puzzle1 ? /^(sample|test)/i.test(puzzle1.id) : null,
  moves: puzzle1?.moves, rating: info1.rating, puzzleNum: info1.puzzleNum,
  themes: info1.themes, feedback: feedback1, boardProbe: boardProbe1,
})
await page.screenshot({ path: `${SCREEN_DIR}/puzzles-step1.png`, fullPage: true })
log('step1: puzzleId=' + puzzle1?.id + ' isStarting=' + (puzzle1 ? (puzzle1.fen === START_FEN) : 'null') + ' feedback=' + feedback1)

// ---------- STEP 2: Correct first move ----------
log('=== STEP 2 ===')
const firstMove = puzzle1?.moves[0]
let step2Feedback = feedback1, step2Placement = p1
if (firstMove) {
  await playMove(page, firstMove.slice(0, 2), firstMove.slice(2, 4))
  step2Placement = await getBoardPlacement(page)
  step2Feedback = await getFeedback(page)
}
record(2, { playedMove: firstMove, placementAfter: step2Placement, placementChanged: step2Placement !== p1, feedback: step2Feedback })
await page.screenshot({ path: `${SCREEN_DIR}/puzzles-step2.png`, fullPage: true })
log('step2: played ' + firstMove + ' changed=' + (step2Placement !== p1) + ' feedback=' + step2Feedback)

// ---------- STEP 3: Solve to completion ----------
log('=== STEP 3 ===')
let solved = false, finalFeedback = step2Feedback
if (puzzle1) {
  for (let i = 2; i < puzzle1.moves.length; i += 2) {
    const mv = puzzle1.moves[i]
    if (!mv) break
    await playMove(page, mv.slice(0, 2), mv.slice(2, 4))
    finalFeedback = await getFeedback(page)
    if (finalFeedback && /solved/i.test(finalFeedback)) { solved = true; break }
  }
  if (!solved && (await page.locator('text=Next Puzzle').count()) > 0) solved = true
}
const beforeNext = await getBoardPlacement(page)
// Click Next Puzzle
let afterNextId = null, afterNextPlacement = null
if ((await page.locator('text=Next Puzzle').count()) > 0) {
  await page.locator('text=Next Puzzle').first().click()
  await page.waitForTimeout(900)
  afterNextPlacement = await getBoardPlacement(page)
  afterNextId = afterNextPlacement ? findPuzzle(afterNextPlacement)?.id : null
}
record(3, {
  solvedDetected: solved, finalFeedback,
  beforeNextPlacement: beforeNext, afterNextPlacement, afterNextPuzzleId: afterNextId,
  afterNextIsDifferent: afterNextId ? (afterNextId !== puzzle1?.id) : null,
  afterNextIsStarting: afterNextPlacement ? (afterNextPlacement === START_FEN.split(' ')[0]) : null,
})
await page.screenshot({ path: `${SCREEN_DIR}/puzzles-step3.png`, fullPage: true })
log('step3: solved=' + solved + ' afterNextId=' + afterNextId)

// ---------- STEP 4: Themed set (Rook Endgame) ----------
log('=== STEP 4 ===')
await page.click('text=Themed Sets')
await page.waitForTimeout(600)
// Pick "Rook Endgame" chip (an actual endgame theme).
await page.locator('button:has-text("Rook Endgame")').first().click()
await page.waitForTimeout(800)
const p4 = await getBoardPlacement(page)
const puzzle4 = findPuzzle(p4)
const info4 = await getInfo(page)
const feedback4 = await getFeedback(page)
const themeLabelVisible = await page.evaluate(() => {
  // The selected chip text
  const chips = Array.from(document.querySelectorAll('button'))
  const active = chips.find(b => /Rook Endgame/.test(b.textContent) && (b.className.includes('sc-') && getComputedStyle(b).backgroundColor !== 'rgba(0, 0, 0, 0)'))
  return active ? active.textContent.trim() : null
})
record(4, {
  pickedTheme: 'Rook Endgame', themeLabelVisible,
  placement: p4, matchedPuzzleId: puzzle4?.id, matchedFen: puzzle4?.fen,
  isStarting: puzzle4 ? (puzzle4.fen === START_FEN) : null,
  themes: puzzle4?.themes, hasRookEndgameTheme: puzzle4 ? puzzle4.themes.includes('rookEndgame') : null,
  rating: info4.rating, puzzleNum: info4.puzzleNum, feedback: feedback4,
})
await page.screenshot({ path: `${SCREEN_DIR}/puzzles-step4.png`, fullPage: true })
log('step4: puzzleId=' + puzzle4?.id + ' hasRookEndgame=' + (puzzle4?.themes.includes('rookEndgame')))

// ---------- STEP 5: Puzzle Rush ----------
log('=== STEP 5 ===')
await page.click('text=Rush')
await page.waitForTimeout(400)
const startRush = page.locator('[data-testid="start-rush"]').first()
if ((await startRush.count()) > 0) { await startRush.click(); await page.waitForTimeout(1000) }
const time1 = await page.evaluate(() => document.querySelector('[data-testid="rush-time"]')?.textContent.trim() ?? null)
await page.waitForTimeout(2200)
const time2 = await page.evaluate(() => document.querySelector('[data-testid="rush-time"]')?.textContent.trim() ?? null)
const rushScore = await page.evaluate(() => document.querySelector('[data-testid="rush-score"]')?.textContent.trim() ?? null)
const rushWrong = await page.evaluate(() => document.querySelector('[data-testid="rush-wrong"]')?.textContent.trim() ?? null)
const p5 = await getBoardPlacement(page)
record(5, {
  time1, time2, timerDecremented: time1 && time2 ? (time1 !== time2) : null,
  score: rushScore, wrong: rushWrong, placement: p5,
})
await page.screenshot({ path: `${SCREEN_DIR}/puzzles-step5.png`, fullPage: true })
log('step5: time1=' + time1 + ' time2=' + time2 + ' decremented=' + (time1 !== time2))

// ---------- STEP 6: Death-Match ----------
log('=== STEP 6 ===')
await page.click('text=Death Match')
await page.waitForTimeout(400)
const startDm = page.locator('[data-testid="start-dm"]').first()
if ((await startDm.count()) > 0) { await startDm.click(); await page.waitForTimeout(1000) }
const lives1 = await page.evaluate(() => document.querySelector('[data-testid="dm-lives"]')?.textContent.trim() ?? null)
const p6 = await getBoardPlacement(page)
const puzzle6 = findPuzzle(p6)
record(6, { lives1, placement1: p6, puzzleId: puzzle6?.id, puzzleMoves: puzzle6?.moves })

// Play a wrong (legal) move to test life decrement.
let wrongMove = null
if (puzzle6) {
  const turn = puzzle6.fen.split(' ')[1]
  const squaresWithPieces = await page.evaluate((color) => {
    const board = document.querySelector('[data-testid="chess-board"]')
    const out = []
    for (const sq of board.querySelectorAll('[data-square]')) {
      const img = sq.querySelector('img')
      if (img && img.getAttribute('alt')[0] === color) out.push(sq.getAttribute('data-square'))
    }
    return out
  }, turn)
  const targets = ['a3','a4','a5','a6','b3','b4','b5','b6','c3','c4','c5','c6','d3','d4','d5','d6','e3','e4','e5','e6','f3','f4','f5','f6','g3','g4','g5','g6','h3','h4','h5','h6']
  outer: for (const square of squaresWithPieces) {
    for (const tgt of targets) {
      if (tgt === square) continue
      const before = await getBoardPlacement(page)
      try { await playMove(page, square, tgt) } catch { continue }
      const after = await getBoardPlacement(page)
      if (after && after !== before) {
        const played = square + tgt
        if (played !== puzzle6.moves[0]) { wrongMove = played; break outer }
      }
    }
  }
}
const lives2 = await page.evaluate(() => document.querySelector('[data-testid="dm-lives"]')?.textContent.trim() ?? null)
record(6, {
  wrongMovePlayed: wrongMove, lives1, lives2,
  livesDecremented: lives1 && lives2 ? (lives2.length < lives1.length) : null,
})
await page.screenshot({ path: `${SCREEN_DIR}/puzzles-step6.png`, fullPage: true })
log('step6: lives1=' + lives1 + ' lives2=' + lives2 + ' wrong=' + wrongMove)

writeFileSync('.pi/acceptance/swarm4/puzzles-probe.json', JSON.stringify(results, null, 2))
console.log('RESULT_JSON_START')
console.log(JSON.stringify(results, null, 2))
console.log('RESULT_JSON_END')
await browser.close()
