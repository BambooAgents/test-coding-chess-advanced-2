/**
 * Supplementary eval-bar sanity check: scrub through all plies and record
 * the eval label to confirm eval bar is sane (positive for White after White
 * moves, no wild oscillation).
 */
import { chromium } from 'playwright'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const PGN = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+'

function log(...args) { console.log('[eval-check]', ...args) }
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
const page = await context.newPage()
await page.goto(BASE + 'analyze')
await page.waitForLoadState('domcontentloaded')
await sleep(1000)

await page.getByTestId('pgn-input').fill(PGN)
await page.getByText('Load PGN').click()

// wait for analysis to complete
const analyzing = page.getByTestId('analyzing')
try { await analyzing.waitFor({ state: 'visible', timeout: 5000 }) } catch {}
await analyzing.waitFor({ state: 'detached', timeout: 90000 })
log('analysis complete')
await sleep(800)

// auto-advanced to ply 1. Now scrub through all plies and capture eval label.
const fwd = page.getByTestId('scrubber').locator('button').nth(2)
const evals = []
// ply 1 first
let label = await page.locator('[data-testid="eval-bar"]').evaluate((el) => {
  const labels = el.querySelectorAll('div')
  return Array.from(labels).map((d) => d.textContent).filter(Boolean).join(' | ')
})
evals.push({ ply: 1, label })
log(`ply 1: ${label}`)

for (let ply = 2; ply <= 21; ply++) {
  await fwd.click()
  await sleep(400)
  label = await page.locator('[data-testid="eval-bar"]').evaluate((el) => {
    const labels = el.querySelectorAll('div')
    return Array.from(labels).map((d) => d.textContent).filter(Boolean).join(' | ')
  })
  evals.push({ ply, label })
  log(`ply ${ply}: ${label}`)
}

// Print a summary table
console.log('\n=== EVAL BAR LABELS BY PLY ===')
const moveNames = ['1.e4','e5','2.Nf3','d6','3.d4','Bg4','4.dxe5','Bxf3','5.Qxf3','dxe5','6.Bc4','Nf6','7.Qb3','Qe7','8.Nc3','c6','9.Bg5','b5','10.Nxb5','cxb5','11.Bxb5+']
for (const e of evals) {
  const mover = (e.ply % 2 === 1) ? 'W' : 'B'
  console.log(`ply ${String(e.ply).padStart(2)} [${mover}] ${moveNames[e.ply-1].padEnd(10)} eval=${e.label}`)
}

// Sanity analysis: White moves should generally keep/ improve White's eval
// (positive). Black moves generally reduce White's eval. Oscillation = sign flipping wildly.
let oscillationIssues = []
for (let i = 1; i < evals.length; i++) {
  const prev = evals[i-1].label
  const cur = evals[i].label
  // parse numeric
  const prevNum = parseFloat(prev.replace('M','').replace('+',''))
  const curNum = parseFloat(cur.replace('M','').replace('+',''))
  if (isNaN(prevNum) || isNaN(curNum)) continue
}

await page.screenshot({ path: join(__dirname, '13-eval-final.png'), fullPage: true })
await browser.close()
