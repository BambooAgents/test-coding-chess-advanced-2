import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'
const PGN = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

// Intercept the analysis result by reading the analysis state from React.
// We'll inject a probe that reads window-attached state. Instead, re-run and
// dump evalBefore/evalAfter by hooking into the engine via console.
// Simpler: re-run analysis and capture the analysis.moves via the DOM move-list
// plus re-derive. Actually the component stores analysis in React state but
// doesn't expose it. Let's just read the eval bar label text per ply which
// shows the cp/mate.

await page.goto(`${BASE}/analyze`, { waitUntil: 'load', timeout: 30000 })
await page.waitForSelector('[data-testid="pgn-input"]', { timeout: 15000 })
await page.fill('[data-testid="pgn-input"]', PGN)
await page.click('text=Load PGN')
await page.waitForSelector('[data-testid="move-list"]', { timeout: 10000 })
const deadline = Date.now() + 40000
while (Date.now() < deadline) {
  if (await page.$('[data-testid="accuracy"]')) break
  await page.waitForTimeout(1000)
}

// Read eval bar labels for each ply
const evals = []
for (let ply = 1; ply <= 21; ply++) {
  const rows = await page.$$('[data-testid="move-list"] button')
  if (rows.length >= ply) {
    await rows[ply - 1].evaluate((el) => el.click())
  }
  await page.waitForTimeout(150)
  const labels = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="eval-bar"]')
    if (!bar) return null
    const labs = bar.querySelectorAll('div')
    return Array.from(labs).map(d => d.textContent).filter(t => t && t.trim())
  })
  evals.push({ ply, labels })
}
writeFileSync('.pi/acceptance/swarm2/eval-per-ply.json', JSON.stringify(evals, null, 2))
evals.forEach(e => console.log(`ply ${String(e.ply).padStart(2)}: ${JSON.stringify(e.labels)}`))
await browser.close()
