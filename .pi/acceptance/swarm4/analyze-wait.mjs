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
page.on('console', msg => { if (msg.type()==='error' || msg.type()==='warning') console.log('CONSOLE', msg.type(), msg.text().slice(0,150)) })
await page.goto(BASE, { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('nav a', { hasText: 'Analyze' }).first().click()
await page.waitForTimeout(600)
await page.locator('[data-testid="pgn-input"]').fill(PGN)
await page.getByRole('button', { name: /Load PGN/i }).click()
await page.locator('[data-testid="chess-board"]').first().waitFor({ state: 'visible', timeout: 10000 })
// Wait for analysis: the analyzing indicator disappears when done. Auto-advances to ply 1.
let analyzed = false
const start = Date.now()
while (Date.now() - start < 90000) {
  const analyzing = await page.locator('[data-testid="analyzing"]').count()
  if (analyzing === 0) { analyzed = true; break }
  await page.waitForTimeout(1500)
}
console.log('analyzed=', analyzed, 'elapsed=', Date.now()-start)
await page.waitForTimeout(500)
// scrub to a middle ply where classifications likely appear
await page.locator('[data-testid="scrubber"] button', { hasText: '▶' }).first().click()
await page.waitForTimeout(400)
await page.screenshot({ path: resolve(SHOT_DIR, 'visual-step5-movelist-analyzed.png'), fullPage: true })
const probe = await page.evaluate(() => {
  const moveList = document.querySelector('[data-testid="move-list"]')
  const board = document.querySelector('[data-testid="chess-board"]')
  const evalBar = document.querySelector('[data-testid="eval-bar"]')
  if (!moveList) return { error: 'no move list' }
  const ml = moveList.getBoundingClientRect()
  const bd = board.getBoundingClientRect()
  const eb = evalBar ? evalBar.getBoundingClientRect() : null
  // find badges: glyphs ?? ‼ ?! ? ! etc.
  const allBadgeEls = Array.from(document.querySelectorAll('[data-testid="move-list"] *')).filter(el => {
    const t = el.textContent?.trim() ?? ''
    return ['??','‼','?!','?','!','✓','☆','★','⩲','⩱','!?'].includes(t)
  }).map(el => {
    const r = el.getBoundingClientRect()
    return { text: el.textContent?.trim(), x: r.x, y: r.y, w: r.width, h: r.height,
      contained: r.x >= ml.x && r.y >= ml.y && r.right <= ml.right && r.bottom <= ml.bottom }
  })
  // eval bar fill: look for a child that has a height
  const evalFill = evalBar ? (() => {
    const inner = evalBar.querySelector('*')
    return inner ? { tag: inner.tagName, h: inner.getBoundingClientRect().height, cls: inner.className?.toString?.()?.slice(0,40) } : null
  })() : null
  return {
    moveList: {x:ml.x,y:ml.y,w:ml.width,h:ml.height,right:ml.right,bottom:ml.bottom},
    board: {x:bd.x,y:bd.y,w:bd.width,h:bd.height,right:bd.right,bottom:bd.bottom},
    evalBar: eb ? {x:eb.x,y:eb.y,w:eb.width,h:eb.height,right:eb.right} : null,
    badgeCount: allBadgeEls.length,
    badges: allBadgeEls,
    allBadgesContained: allBadgeEls.every(b=>b.contained),
    moveListText: moveList.textContent?.trim().slice(0,120),
    overlapsBoard: ml.x < bd.right && ml.right > bd.x,
    evalFill,
  }
})
writeFileSync(resolve(PROBE_DIR, 'step5-analyzed.json'), JSON.stringify(probe, null, 2))
console.log(JSON.stringify(probe, null, 2))
await browser.close()
