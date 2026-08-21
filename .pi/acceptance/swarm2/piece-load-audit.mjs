// Verify piece SVG images load and render on the board (play + puzzles).
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const out = {}

for (const [name, path] of [['play','play'],['puzzles','puzzles']]) {
  const failedImgs = []
  page.on('response', async (r) => {
    if (r.url().includes('/pieces/') && !r.ok()) failedImgs.push({ url: r.url(), status: r.status() })
  })
  await page.goto(BASE + path, { waitUntil: 'load' })
  try { await page.waitForSelector('main', { timeout: 8000 }) } catch {}
  await page.waitForTimeout(1200)
  const imgInfo = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('main img'))
    return {
      totalImgs: imgs.length,
      pieceImgs: imgs.filter(i => i.src.includes('/pieces/')).length,
      loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(-8)),
      srcs: imgs.filter(i => i.src.includes('/pieces/')).slice(0,12).map(i => i.src.split('/pieces/')[1]),
    }
  })
  out[name] = { imgInfo, failedImgs }
  console.log(`\n=== ${name} ===`)
  console.log(JSON.stringify(imgInfo, null, 2))
  if (failedImgs.length) console.log('FAILED IMG REQUESTS:', JSON.stringify(failedImgs))
  page.removeAllListeners('response')
}

writeFileSync('.pi/acceptance/swarm2/piece-load-audit.json', JSON.stringify(out, null, 2))
await browser.close()
