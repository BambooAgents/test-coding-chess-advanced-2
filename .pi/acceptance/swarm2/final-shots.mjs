import { chromium } from 'playwright'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'
const SHOTS = '.pi/acceptance/swarm2/screenshots'
const PGN = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+'

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
await page.goto(`${BASE}/analyze`, { waitUntil: 'load', timeout: 30000 })
await page.waitForSelector('[data-testid="pgn-input"]', { timeout: 15000 })
await page.fill('[data-testid="pgn-input"]', PGN)
await page.click('text=Load PGN')
await page.waitForSelector('[data-testid="move-list"]', { timeout: 10000 })
// wait for FULL completion
const start = Date.now()
while (Date.now() - start < 90000) {
  if (!(await page.$('[data-testid="analyzing"]'))) break
  await page.waitForTimeout(1000)
}
await page.waitForTimeout(500)
// scrub to ply 19 (the Nxb5 brilliant move) for a screenshot showing the brilliant badge in context
const rows = await page.$$('[data-testid="move-list"] button')
if (rows.length >= 19) await rows[18].evaluate((el) => el.click())
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/analyze-brilliant-ply19.png`, fullPage: true })
// also scrub to ply 1 to show the questionable 1.e4 ?! badge
if (rows.length >= 1) await rows[0].evaluate((el) => el.click())
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/analyze-e4-inaccuracy-ply1.png`, fullPage: true })
// full completed state at ply 21
if (rows.length >= 21) await rows[20].evaluate((el) => el.click())
await page.waitForTimeout(300)
await page.screenshot({ path: `${SHOTS}/analyze-complete-ply21.png`, fullPage: true })
console.log('screenshots saved')
await browser.close()
