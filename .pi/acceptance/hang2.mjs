// Full analyze of the Immortal with per-move timing to find the hang move.
import { chromium } from '@playwright/test'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('console', (m) => console.log('['+m.type()+']', m.text()))
page.on('pageerror', (e) => console.log('[PAGEERR]', e.message))

await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' })
await sleep(1500)

const immortal = `[Event "London"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`

await page.fill('[data-testid="pgn-input"]', immortal)
const t0 = Date.now()
await page.click('text=Load PGN')

let last = ''
const seen = new Set()
for (let i = 0; i < 180; i++) {
  await sleep(1000)
  const status = await page.evaluate(() => document.querySelector('[data-testid="analyzing"]')?.innerText || null)
  const err = await page.evaluate(() => document.querySelector('[data-testid="analyze-error"]')?.innerText || null)
  if (err) { console.log('ERROR at', Date.now()-t0, 'ms:', err); break }
  if (status && status !== last) {
    console.log('t=' + (Date.now()-t0)/1000 + 's:', status)
    last = status
  }
  if (!status) { console.log('FINISHED at t=' + (Date.now()-t0)/1000 + 's'); break }
}
const fin = await page.evaluate(() => ({ acc: document.querySelector('[data-testid="accuracy"]')?.innerText || null, err: document.querySelector('[data-testid="analyze-error"]')?.innerText || null, analyzing: document.querySelector('[data-testid="analyzing"]')?.innerText || null }))
console.log('FINAL:', JSON.stringify(fin))
await browser.close()
