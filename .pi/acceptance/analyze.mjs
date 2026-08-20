// Focused: Analyze with a real, verified-loadable PGN (The Immortal Game, 45 plies)
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const OUT = '.pi/acceptance/screenshots/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function shot(page, name) { const path = OUT + name + '.png'; await page.screenshot({ path, fullPage: true }); console.log('SHOT', path); }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

const immortal = `[Event "London"]
[Site "London ENG"]
[Date "1851.06.21"]
[White "Adolf Anderssen"]
[Black "Lionel Kieseritzky"]
[Result "1-0"]

1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5 8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8 15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6 21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`

await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' })
await sleep(1500)
await shot(page, 'analyze-empty')
await page.fill('[data-testid="pgn-input"]', immortal)
await page.click('text=Load PGN')

let waited = 0
let lastProgress = ''
while (waited < 150) {
  await sleep(1000)
  waited++
  const statusText = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="analyzing"]')
    return el ? el.innerText : null
  })
  if (statusText) { lastProgress = statusText; if (waited % 5 === 0) console.log('progress:', statusText) }
  else break
}
console.log('analyze waited sec:', waited, 'lastProgress:', lastProgress)
await sleep(500)
await shot(page, 'analyze-immortal')

const accuracyText = await page.evaluate(() => { const el = document.querySelector('[data-testid="accuracy"]'); return el ? el.innerText : null })
console.log('ACCURACY_TEXT:', accuracyText)
const moveListText = await page.evaluate(() => { const el = document.querySelector('[data-testid="move-list"]'); return el ? el.innerText : null })
console.log('MOVE_LIST sample:\n', moveListText ? moveListText.slice(0, 1500) : 'NO MOVE LIST')
const errBox = await page.locator('[data-testid="analyze-error"]').count()
console.log('analyze-error count:', errBox)
if (errBox) console.log('analyze-error text:', await page.locator('[data-testid="analyze-error"]').innerText())
const bodyText = await page.evaluate(() => document.body.innerText)
console.log('brilliant(!!) count:', (bodyText.match(/!!/g) || []).length)
console.log('blunder(??) count:', (bodyText.match(/\?\?/g) || []).length)

console.log('--- CONSOLE ERRORS (' + consoleErrors.length + ') ---')
for (const e of consoleErrors.slice(0, 40)) console.log('ERR:', e)
await browser.close()
console.log('DONE')
