import { chromium } from 'playwright'

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

// wait for analysis to make progress / accuracy
const deadline = Date.now() + 40000
while (Date.now() < deadline) {
  const acc = await page.$('[data-testid="accuracy"]')
  if (acc) break
  await page.waitForTimeout(1000)
}

// probe arrow rendering at various plies
const probe = {}
for (const ply of [1, 3, 6, 11]) {
  const rows = await page.$$('[data-testid="move-list"] button')
  if (rows.length >= ply) {
    await rows[ply - 1].evaluate((el) => el.click())
  }
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => {
    const svg = document.querySelector('[data-testid="board-arrows"]')
    const lines = svg ? svg.querySelectorAll('line').length : 0
    const polys = svg ? svg.querySelectorAll('polygon').length : 0
    const paths = svg ? svg.querySelectorAll('path').length : 0
    const svgHtml = svg ? svg.outerHTML.slice(0, 400) : null
    // eval bar
    const bar = document.querySelector('[data-testid="eval-bar"]')
    const fill = bar ? bar.firstElementChild : null
    const fillStyle = fill ? getComputedStyle(fill) : null
    return {
      hasSvg: !!svg,
      lines, polys, paths,
      svgSnippet: svgHtml,
      evalBarBg: bar ? getComputedStyle(bar).backgroundColor : null,
      evalBarHeight: bar ? getComputedStyle(bar).height : null,
      fillHeight: fillStyle ? fillStyle.height : null,
      fillBg: fillStyle ? fillStyle.backgroundColor : null,
      fillPctAttr: fill ? fill.getAttribute('style') : null,
      scrubText: document.querySelector('[data-testid="scrubber"]')?.textContent,
    }
  })
  probe[ply] = r
}

console.log(JSON.stringify(probe, null, 2))
await browser.close()
