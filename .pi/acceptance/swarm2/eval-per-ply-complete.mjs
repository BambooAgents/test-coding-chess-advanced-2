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

// Wait for analyzing to DISAPPEAR (full completion), not just accuracy to appear
const start = Date.now()
while (Date.now() - start < 90000) {
  const analyzing = await page.$('[data-testid="analyzing"]')
  if (!analyzing) break
  await page.waitForTimeout(1000)
}
console.log(`analysis finished at t=${Math.round((Date.now()-start)/1000)}s`)
await page.waitForTimeout(500)

// Now probe eval bar + classification for ALL plies
const evals = []
for (let ply = 1; ply <= 21; ply++) {
  const rows = await page.$$('[data-testid="move-list"] button')
  if (rows.length >= ply) {
    await rows[ply - 1].evaluate((el) => el.click())
  }
  await page.waitForTimeout(120)
  const r = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="eval-bar"]')
    const fill = bar?.firstElementChild
    const labels = bar ? Array.from(bar.querySelectorAll('div')).map(d=>d.textContent).filter(t=>t&&t.trim()) : []
    return {
      label: labels.join('|'),
      fillHeight: fill ? getComputedStyle(fill).height : null,
      fillBg: fill ? getComputedStyle(fill).backgroundColor : null,
    }
  })
  evals.push({ ply, ...r })
}
writeFileSync('.pi/acceptance/swarm2/eval-per-ply-complete.json', JSON.stringify(evals, null, 2))
evals.forEach(e => console.log(`ply ${String(e.ply).padStart(2)}: label="${e.label}" fillH=${e.fillHeight}`))

// Also re-dump classifications now that analysis is complete
const cls = await page.evaluate(() => {
  const rows = document.querySelectorAll('[data-testid="move-list"] button')
  const out = []
  rows.forEach((r) => {
    const spans = r.querySelectorAll('span')
    out.push({
      san: spans[1]?.textContent,
      badge: spans[2]?.textContent,
      color: spans[2] ? getComputedStyle(spans[2]).color : null,
    })
  })
  const acc = document.querySelector('[data-testid="accuracy"]')?.textContent
  return { moves: out, accuracy: acc }
})
writeFileSync('.pi/acceptance/swarm2/move-classifications-complete.json', JSON.stringify(cls, null, 2))
console.log('\naccuracy:', cls.accuracy)
cls.moves.forEach((m,i) => console.log(`  ${i+1}. ${(m.san||'').padEnd(8)} badge="${m.badge}" color=${m.color}`))
await browser.close()
