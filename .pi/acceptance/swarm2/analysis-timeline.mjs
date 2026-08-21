import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'
const PGN = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
await page.goto(`${BASE}/analyze`, { waitUntil: 'load', timeout: 30000 })
await page.waitForSelector('[data-testid="pgn-input"]', { timeout: 15000 })
await page.fill('[data-testid="pgn-input"]', PGN)
await page.click('text=Load PGN')
await page.waitForSelector('[data-testid="move-list"]', { timeout: 10000 })

// Poll the analyzing status text every 2s for 90s, and record final state
const log = []
const start = Date.now()
while (Date.now() - start < 90000) {
  const status = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="analyzing"]')
    const acc = document.querySelector('[data-testid="accuracy"]')
    const err = document.querySelector('[data-testid="analyze-error"]')
    return {
      analyzing: a ? a.textContent : null,
      accuracy: acc ? acc.textContent : null,
      error: err ? err.textContent : null,
      moveListRows: document.querySelectorAll('[data-testid="move-list"] button').length,
    }
  })
  log.push({ t: Math.round((Date.now() - start)/1000), ...status })
  if (!status.analyzing && status.accuracy) {
    // finished — but keep monitoring a few more seconds in case it's a lull
  }
  // stop if analyzing gone for 5 consecutive checks AND we have accuracy
  await page.waitForTimeout(2000)
  const last = log[log.length-1]
  if (!last.analyzing && last.accuracy && (Date.now() - start) > 30000) break
}
writeFileSync('.pi/acceptance/swarm2/analysis-timeline.json', JSON.stringify(log, null, 2))
console.log('timeline:')
log.forEach(l => console.log(`t=${l.t}s analyzing=${l.analyzing} acc=${l.accuracy} rows=${l.moveListRows} err=${l.error}`))
await browser.close()
