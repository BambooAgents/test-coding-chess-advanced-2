// Reproduce the analysis hang: evaluate the positions around the last move of the Immortal.
import { chromium } from '@playwright/test'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => { console.log('['+m.type()+']', m.text()); if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => console.log('[PAGEERR]', e.message))

await page.goto(BASE + 'stockfish-test.html', { waitUntil: 'domcontentloaded' })
await sleep(3000)

// Inject a script that evaluates specific FENs and times them
const fens = [
  // Position before 23.Be7# (after 22...Nxf6): White to move
  'r1bk3r/p1p2ppp/n1b1p3/4N2Q/1BP5/1q3P2/PBPP1qPP/R1B2RK1 w - - 0 23',
  // Checkmate position after 23.Be7#
  'r1b1k2r/p1pBbppp/n1b1p3/4N2Q/1BP5/1q3P2/PBPP1qPP/R1B2RK1 b - - 0 23',
]
const results = await page.evaluate(async (fens) => {
  const { StockfishEngine } = await import('/test-coding-chess-advanced-2/src/engine/StockfishEngine.ts')
  const engine = new StockfishEngine()
  const out = []
  await engine.init()
  out.push({ step: 'init ok' })
  for (const fen of fens) {
    const t0 = performance.now()
    try {
      const r = await Promise.race([
        engine.getEvaluation(fen, 12),
        new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT 60s')), 60000)),
      ])
      out.push({ fen: fen.slice(0,30), ms: Math.round(performance.now() - t0), score: r.score, mate: r.mate, depth: r.depth, bestMove: r.bestMove })
    } catch (e) {
      out.push({ fen: fen.slice(0,30), ms: Math.round(performance.now() - t0), error: e.message })
    }
  }
  engine.destroy()
  return out
}, fens)
console.log('RESULTS:', JSON.stringify(results, null, 2))
await browser.close()
console.log('DONE')
