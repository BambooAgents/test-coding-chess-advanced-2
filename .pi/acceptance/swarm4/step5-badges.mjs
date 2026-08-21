import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const SHOT_DIR = resolve('.pi/acceptance/swarm4/screenshots')
const PROBE_DIR = resolve('.pi/acceptance/swarm4/probes')
mkdirSync(SHOT_DIR, { recursive: true })
const PGN = `[Event "Ruy Lopez Closed"]
[White "A"]
[Black "B"]
[Result "*"]
[Opening "Ruy Lopez"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. a4 c5 14. b4 c4 15. Bb3 Qc7 16. Nf1 Rac8 17. Ng3 g6 18. d5 *`
const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('nav a', { hasText: 'Analyze' }).first().click()
await page.waitForTimeout(600)
await page.locator('[data-testid="pgn-input"]').fill(PGN)
await page.getByRole('button', { name: /Load PGN/i }).click()
await page.locator('[data-testid="chess-board"]').first().waitFor({ state: 'visible', timeout: 10000 })
const start = Date.now()
while (Date.now()-start < 90000) {
  if ((await page.locator('[data-testid="analyzing"]').count())===0) break
  await page.waitForTimeout(1500)
}
await page.waitForTimeout(500)
// Click on move 14 (b4?!) in the move list to scroll to it and scrub there.
// Move rows have data-ply. ply 27 = move 14 white (b4).
const clicked = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('[data-testid="move-list"] [data-ply]'))
  const target = rows.find(r => r.getAttribute('data-ply') === '27')
  if (target) { target.scrollIntoView({ block: 'center' }); target.click(); return { ok: true, ply: 27 } }
  // fallback: click first row with a badge
  return { ok: false, rowCount: rows.length }
})
console.log('clicked move 14:', JSON.stringify(clicked))
await page.waitForTimeout(600)
await page.screenshot({ path: resolve(SHOT_DIR, 'visual-step5-movelist-badges.png'), fullPage: true })
const probe = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]')
  const board = document.querySelector('[data-testid="chess-board"]')
  const mlr = ml.getBoundingClientRect()
  const bdr = board.getBoundingClientRect()
  // badges that are VISIBLE within the move-list viewport (scroll container)
  const allBadgeEls = Array.from(ml.querySelectorAll('*')).filter(el => {
    const t = el.textContent?.trim() ?? ''
    if (!['??','‼','?!','?','!','✓','☆','★','!?'].includes(t)) return false
    const r = el.getBoundingClientRect()
    // visible within the scroll container AND within viewport
    return r.x >= mlr.x && r.right <= mlr.right && r.y >= mlr.y && r.bottom <= mlr.bottom && r.height > 0
  }).map(el => {
    const r = el.getBoundingClientRect()
    return { text: el.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height,
      inColumn: r.x >= mlr.x && r.right <= mlr.right }
  })
  // also check current ply scrubber
  const scrubber = document.querySelector('[data-testid="scrubber"]')?.textContent?.trim()
  return {
    moveList: {x:mlr.x,y:mlr.y,w:mlr.width,h:mlr.height,right:mlr.right,bottom:mlr.bottom},
    board: {x:bdr.x,y:bdr.y,w:bdr.width,h:bdr.height,right:bdr.right,bottom:bdr.bottom},
    overlapBoard: mlr.x < bdr.right && mlr.right > bdr.x,
    visibleBadgeCount: allBadgeEls.length,
    visibleBadges: allBadgeEls,
    scrubber,
    moveListTopText: ml.textContent?.trim().slice(0,80),
  }
})
writeFileSync(resolve(PROBE_DIR, 'step5-badges-visible.json'), JSON.stringify(probe, null, 2))
console.log(JSON.stringify(probe, null, 2))
await browser.close()
