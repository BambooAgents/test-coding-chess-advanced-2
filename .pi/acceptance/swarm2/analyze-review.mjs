/**
 * Hostile acceptance review — Analyze page.
 * Boots the real dev server's analyze page, pastes a real short PGN, runs
 * analysis to completion, and DOM-checks + screenshots each state.
 */
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'
const SHOTS = '.pi/acceptance/swarm2/screenshots'
mkdirSync(SHOTS, { recursive: true })

const PGN = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+'

const results = {
  bootUrl: null,
  pgnLoaded: false,
  moveCountLoaded: 0,
  analysisCompleted: false,
  analysisMoveCount: 0,
  finalStatus: null,
  evalBarHeight: null,
  evalBarFillHeight: null,
  accuracyWhite: null,
  accuracyBlack: null,
  brilliantPresent: false,
  brilliantColor: null,
  arrowCount: 0,
  moveListRowCount: 0,
  scrubStates: [],
  domProbe: null,
  errorText: null,
  consoleErrors: [],
  pageErrors: [],
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()

page.on('console', (msg) => {
  if (msg.type() === 'error') results.consoleErrors.push(msg.text())
})
page.on('pageerror', (err) => {
  results.pageErrors.push(String(err))
})

// 1. Navigate to /analyze
console.log('[1] navigating to /analyze ...')
await page.goto(`${BASE}/analyze`, { waitUntil: 'load', timeout: 30000 })
results.bootUrl = page.url()
await page.waitForSelector('[data-testid="pgn-input"]', { timeout: 15000 })

// 2. Paste PGN
console.log('[2] pasting PGN ...')
await page.fill('[data-testid="pgn-input"]', PGN)

// 3. Click Load PGN
console.log('[3] clicking Load PGN ...')
await page.click('text=Load PGN')

// Wait for the game to load: opening name or move list appears
try {
  await page.waitForSelector('[data-testid="move-list"]', { timeout: 10000 })
  results.pgnLoaded = true
} catch {
  results.pgnLoaded = false
}

// Wait for analyzing status to appear (or move list)
try {
  await page.waitForSelector('[data-testid="analyzing"], [data-testid="accuracy"]', { timeout: 10000 })
} catch {}

// 4. Wait up to 40s for analysis to complete (accuracy appears OR analyzing disappears)
console.log('[4] waiting for analysis to complete (up to 40s) ...')
const deadline = Date.now() + 40000
let done = false
while (Date.now() < deadline && !done) {
  const analyzing = await page.$('[data-testid="analyzing"]')
  const accuracy = await page.$('[data-testid="accuracy"]')
  if (accuracy) { done = true; results.analysisCompleted = true; break }
  if (!analyzing) {
    // analyzing gone — check if accuracy came through or analysis moved
    await page.waitForTimeout(500)
    const acc2 = await page.$('[data-testid="accuracy"]')
    if (acc2) { done = true; results.analysisCompleted = true; break }
    // maybe no accuracy (single-side?) — check move list has badges
    const badges = await page.$$eval('[data-testid="move-list"] .move-row, [data-testid="move-list"] button', els => els.length)
    if (badges > 0) { done = true; results.analysisCompleted = true; break }
  }
  await page.waitForTimeout(1000)
}

// Capture analyzing status text
const analyzingEl = await page.$('[data-testid="analyzing"]')
if (analyzingEl) {
  results.finalStatus = await analyzingEl.textContent()
}

// 5. Screenshot: analyze-loaded
console.log('[5] screenshot analyze-loaded.png ...')
await page.screenshot({ path: `${SHOTS}/analyze-loaded.png`, fullPage: true })

// DOM probe after load
results.moveCountLoaded = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]')
  if (!ml) return 0
  return ml.querySelectorAll('button').length
})

// 6. DOM: eval bar, accuracy, brilliant badge, arrows, move list
console.log('[6] DOM probing ...')
results.domProbe = await page.evaluate(() => {
  const out = {}
  // accuracy
  const acc = document.querySelector('[data-testid="accuracy"]')
  out.accuracyText = acc ? acc.textContent : null
  // eval bar — find the styled-components container; look for the fill element
  // EvalBar component: look for a div with role or class containing 'eval'
  const evalBars = document.querySelectorAll('[class*="EvalBar"], [data-testid="eval-bar"], div[class*="eval" i]')
  out.evalBarCandidates = []
  document.querySelectorAll('div').forEach(d => {
    const cs = getComputedStyle(d)
    // an eval bar is typically a tall narrow strip
    if (parseFloat(cs.width) > 0 && parseFloat(cs.width) < 60 && parseFloat(cs.height) > 200) {
      const fill = d.firstElementChild
      if (fill) {
        const fcs = getComputedStyle(fill)
        if (parseFloat(fcs.height) > 0) {
          out.evalBarCandidates.push({
            width: cs.width, height: cs.height,
            fillHeight: fcs.height, fillBg: fcs.backgroundColor, fillColor: fcs.color,
          })
        }
      }
    }
  })
  // brilliant badge — look for purple colored spans
  out.brilliantSpans = []
  document.querySelectorAll('span').forEach(s => {
    const cs = getComputedStyle(s)
    const c = cs.color
    if (c === 'rgb(168, 85, 247)' || /168.*85.*247/.test(c)) {
      out.brilliantSpans.push({ text: s.textContent, color: c, fontSize: cs.fontSize })
    }
  })
  // arrows — SVG lines/paths on the board
  const svg = document.querySelector('svg')
  out.arrowCount = svg ? svg.querySelectorAll('line, path, polygon').length : 0
  // move list rows
  const ml = document.querySelector('[data-testid="move-list"]')
  out.moveListRowCount = ml ? ml.querySelectorAll('button').length : 0
  // all badge colors present
  out.badgeColors = []
  document.querySelectorAll('[data-testid="move-list"] span').forEach(s => {
    const cs = getComputedStyle(s)
    if (cs.color && cs.color !== 'rgba(0, 0, 0, 0)' && cs.color !== 'transparent') {
      out.badgeColors.push({ text: s.textContent, color: cs.color })
    }
  })
  // current ply text
  const scrub = document.querySelector('[data-testid="scrubber"]')
  out.scrubText = scrub ? scrub.textContent : null
  return out
})

if (results.domProbe) {
  results.accuracyWhite = results.domProbe.accuracyText
  results.arrowCount = results.domProbe.arrowCount
  results.moveListRowCount = results.domProbe.moveListRowCount
  results.evalBarHeight = results.domProbe.evalBarCandidates?.[0]?.height ?? null
  results.evalBarFillHeight = results.domProbe.evalBarCandidates?.[0]?.fillHeight ?? null
  results.brilliantPresent = (results.domProbe.brilliantSpans?.length ?? 0) > 0
  results.brilliantColor = results.domProbe.brilliantSpans?.[0]?.color ?? null
}

// 7. Scrub through moves and screenshot each
console.log('[7] scrubbing through moves ...')
const scrubStops = [3, 6, 9, 11]
for (const ply of scrubStops) {
  // use the forward button
  // simpler: click move list rows directly
  const rows = await page.$$('[data-testid="move-list"] button')
  if (rows.length >= ply) {
    try {
      await rows[ply - 1].click({ timeout: 5000 })
    } catch (e) {
      // try evaluate click
      await rows[ply - 1].evaluate((el) => el.click())
    }
  }
  await page.waitForTimeout(400)
  const shot = `${SHOTS}/analyze-scrub-ply${ply}.png`
  await page.screenshot({ path: shot, fullPage: true })
  const scrubText = await page.evaluate(() => {
    const s = document.querySelector('[data-testid="scrubber"]')
    return s ? s.textContent : null
  })
  results.scrubStates.push({ ply, shot, scrubText })
}

// 8. Final screenshot at ply 11 (the Nxb5 / Bxb5+ move — tactical)
console.log('[8] final screenshot ...')
await page.screenshot({ path: `${SHOTS}/analyze-final.png`, fullPage: true })

// error check
const errEl = await page.$('[data-testid="analyze-error"]')
if (errEl) results.errorText = await errEl.textContent()

await browser.close()

writeFileSync('.pi/acceptance/swarm2/analyze-dom-results.json', JSON.stringify(results, null, 2))
console.log('=== RESULTS ===')
console.log(JSON.stringify(results, null, 2))
console.log('DONE')
