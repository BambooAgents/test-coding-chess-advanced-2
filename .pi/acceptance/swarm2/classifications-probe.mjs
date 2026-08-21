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
const deadline = Date.now() + 40000
while (Date.now() < deadline) {
  if (await page.$('[data-testid="accuracy"]')) break
  await page.waitForTimeout(1000)
}

// Per-move classification dump
const data = await page.evaluate(() => {
  const rows = document.querySelectorAll('[data-testid="move-list"] button')
  const out = []
  rows.forEach((r) => {
    const spans = r.querySelectorAll('span')
    const san = spans.length >= 2 ? spans[1].textContent : ''
    const badge = spans.length >= 3 ? spans[2].textContent : ''
    const badgeColor = spans.length >= 3 ? getComputedStyle(spans[2]).color : ''
    const isCurrent = r.className.includes('accent') || getComputedStyle(r).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(r).backgroundColor !== 'transparent'
    out.push({ san, badge, badgeColor, rowBg: getComputedStyle(r).backgroundColor })
  })
  // accuracy + opening
  const acc = document.querySelector('[data-testid="accuracy"]')?.textContent
  const opening = document.querySelector('div')?.textContent
  return { moves: out, accuracy: acc }
})
writeFileSync('.pi/acceptance/swarm2/move-classifications.json', JSON.stringify(data, null, 2))
console.log('accuracy:', data.accuracy)
console.log('moves:')
data.moves.forEach((m, i) => console.log(`  ${i+1}. ${m.san.padEnd(8)} badge="${m.badge}" color=${m.badgeColor}`))
await browser.close()
