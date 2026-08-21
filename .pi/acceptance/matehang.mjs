// Does `go depth 12` hang on a true checkmate position?
import { chromium } from '@playwright/test'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('console', (m) => console.log('['+m.type()+']', m.text()))
page.on('pageerror', (e) => console.log('[PAGEERR]', e.message))
await page.goto('http://localhost:5183/test-coding-chess-advanced-2/stockfish-test.html', { waitUntil: 'domcontentloaded' })
await sleep(2500)

// A genuine checkmate position (fool's mate): black king mated, side to move is black but it's mate.
// Actually need a position where it IS checkmate. Use: 1.f3 e5 2.g4 Qh4#  -> black to move is mated? No, after Qh4# it's white's move and white is checkmated.
// FEN after 1.f3 e5 2.g4 Qh4# : rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3
const mateFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
const results = await page.evaluate(async (mateFen) => {
  const { StockfishEngine } = await import('/test-coding-chess-advanced-2/src/engine/StockfishEngine.ts')
  const engine = new StockfishEngine()
  await engine.init()
  const out = []
  const t0 = performance.now()
  try {
    const r = await Promise.race([
      engine.getEvaluation(mateFen, 12),
      new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT 30s')), 30000)),
    ])
    out.push({ ms: Math.round(performance.now()-t0), score: r.score, mate: r.mate, depth: r.depth, bestMove: r.bestMove })
  } catch (e) {
    out.push({ ms: Math.round(performance.now()-t0), error: e.message })
  }
  engine.destroy()
  return out
}, mateFen)
console.log('MATE EVAL RESULT:', JSON.stringify(results))
await browser.close()
console.log('DONE')
