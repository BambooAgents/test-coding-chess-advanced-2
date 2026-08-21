// Deep board inspection: confirm the chess board actually renders squares + pieces,
// not an empty placeholder. Check play and puzzles pages.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const out = {}

for (const [name, path] of [['play','play'],['puzzles','puzzles']]) {
  await page.goto(BASE + path, { waitUntil: 'load' })
  try { await page.waitForSelector('main', { timeout: 8000 }) } catch {}
  await page.waitForTimeout(800)
  const boardInfo = await page.evaluate(() => {
    // chessboard typically a grid of 64 squares
    const all = Array.from(document.querySelectorAll('main div'))
    // find a div that has 64 children (squares)
    let board = null
    for (const d of all) {
      if (d.children.length === 64) {
        const r = d.getBoundingClientRect()
        if (r.width > 100 && r.height > 100) { board = d; break }
      }
    }
    if (!board) {
      // fallback: find largest square-ish div
      let best = null, bestArea = 0
      for (const d of all) {
        const r = d.getBoundingClientRect()
        if (r.width > 200 && r.width === r.height && r.width > bestArea) { best = d; bestArea = r.width }
      }
      board = best
    }
    if (!board) return { hasBoard: false }
    const r = board.getBoundingClientRect()
    const squares = Array.from(board.children).map(c => ({
      text: c.textContent.trim(),
      color: getComputedStyle(c).backgroundColor,
      w: Math.round(c.getBoundingClientRect().width),
      h: Math.round(c.getBoundingClientRect().height),
    }))
    const pieces = squares.filter(s => s.text.length > 0)
    return {
      hasBoard: true,
      boardSize: { w: Math.round(r.width), h: Math.round(r.height) },
      squareCount: squares.length,
      squareSize: squares[0] ? { w: squares[0].w, h: squares[0].h } : null,
      piecesWithGlyph: pieces.length,
      samplePieces: pieces.slice(0, 12).map(s => s.text),
      sampleSquareColors: [...new Set(squares.map(s=>s.color))],
    }
  }, name)
  out[name] = boardInfo
  console.log(`\n=== ${name} board ===`)
  console.log(JSON.stringify(boardInfo, null, 2))
}

writeFileSync('.pi/acceptance/swarm2/board-inspection.json', JSON.stringify(out, null, 2))
await browser.close()
