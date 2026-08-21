import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const PUZZLES_URL = BASE + 'puzzles'
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const puzzleJson = JSON.parse(readFileSync('src/data/puzzles.json', 'utf8'))
const fenToPuzzle = new Map()
for (const p of puzzleJson) fenToPuzzle.set(p.fen.split(' ')[0], p)
function findPuzzle(placement) { return fenToPuzzle.get(placement) || null }

async function getBoardPlacement(page) {
  return await page.evaluate(() => {
    const board = document.querySelector('[data-testid="chess-board"]')
    if (!board) return null
    const map = {}
    for (const sq of board.querySelectorAll('[data-square]')) {
      map[sq.getAttribute('data-square')] = sq.querySelector('img')?.getAttribute('alt') || null
    }
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

// Read the feedback banner precisely (the styled feedback area, not stats).
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

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const out = {}

await page.goto(PUZZLES_URL)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1200)

// --- solve step1 puzzle to completion, then click Next Puzzle and verify board changes ---
const p1 = await getBoardPlacement(page)
const puzzle1 = findPuzzle(p1)
out.p1 = { placement: p1, puzzleId: puzzle1?.id, fen: puzzle1?.fen, moves: puzzle1?.moves, feedback: await getFeedback(page) }

// play moves[0], moves[2], ...
for (let i = 0; i < puzzle1.moves.length; i += 2) {
  const mv = puzzle1.moves[i]
  const from = mv.slice(0, 2), to = mv.slice(2, 4)
  await page.click(`[data-square="${from}"]`); await page.waitForTimeout(100)
  await page.click(`[data-square="${to}"]`); await page.waitForTimeout(400)
}
out.afterSolveFeedback = await getFeedback(page)
out.hasNextButton = await page.locator('text=Next Puzzle').count()
// screenshot the solved state
await page.screenshot({ path: '.pi/acceptance/swarm4/screenshots/debug-solved.png', fullPage: true })

// Now click Next Puzzle and check board changes
const beforeNext = await getBoardPlacement(page)
await page.locator('text=Next Puzzle').first().click()
await page.waitForTimeout(800)
const afterNext = await getBoardPlacement(page)
out.nextPuzzle = {
  beforeNextPlacement: beforeNext,
  afterNextPlacement: afterNext,
  afterNextPuzzleId: afterNext ? findPuzzle(afterNext)?.id : null,
  boardStillPresent: !!afterNext,
}

writeFileSync('.pi/acceptance/swarm4/debug-solve.json', JSON.stringify(out, null, 2))
console.log(JSON.stringify(out, null, 2))
await browser.close()
