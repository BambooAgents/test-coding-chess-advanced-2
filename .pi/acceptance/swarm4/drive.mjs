// Playwright driver for swarm 4 visual-home acceptance review.
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const SHOT_DIR = resolve('.pi/acceptance/swarm4/screenshots')
const PROBE_DIR = resolve('.pi/acceptance/swarm4/probes')
mkdirSync(SHOT_DIR, { recursive: true })
mkdirSync(PROBE_DIR, { recursive: true })

const OPERA_PGN = `[Event "Ruy Lopez Closed"]
[White "A"]
[Black "B"]
[Result "*"]
[Opening "Ruy Lopez"]
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 13. a4 c5 14. b4 c4 15. Bb3 Qc7 16. Nf1 Rac8 17. Ng3 g6 18. d5 *`

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
const probes = {}

async function shot(name) {
  const path = resolve(SHOT_DIR, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}
async function probe(name, fn) {
  const result = await page.evaluate(fn)
  probes[name] = result
  writeFileSync(resolve(PROBE_DIR, `${name}.json`), JSON.stringify(result, null, 2))
  return result
}
async function wait(ms) { await page.waitForTimeout(ms) }
async function clickNav(label) {
  await page.locator('nav a', { hasText: label }).first().click()
  await wait(700)
}
async function activeHref() {
  return page.evaluate(() => {
    const a = document.querySelector('nav a.active, nav a[aria-current="page"]')
    return a?.getAttribute('href') ?? null
  })
}

// ---------- STEP 1: Home ----------
console.log('STEP 1: Home')
await page.goto(BASE, { waitUntil: 'networkidle' })
await wait(1000)
await shot('visual-step1')
await probe('step1-nav', () => {
  const nav = document.querySelector('nav')
  const links = Array.from(document.querySelectorAll('nav a')).map(a => ({
    text: a.textContent?.trim(),
    href: a.getAttribute('href'),
    active: a.classList.contains('active') || a.getAttribute('aria-current') === 'page',
  }))
  const header = document.querySelector('header')
  const main = document.querySelector('main')
  return {
    navExists: !!nav,
    headerRect: header ? header.getBoundingClientRect() : null,
    mainRect: main ? main.getBoundingClientRect() : null,
    links,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    mainHasContent: (main?.textContent?.trim().length ?? 0) > 10,
  }
})

// ---------- STEP 2: Nav routing ----------
console.log('STEP 2: Nav routing')
const routes = ['Play', 'Analyze', 'Puzzles', 'My Weaknesses']
const step2results = []
for (let i = 0; i < routes.length; i++) {
  const label = routes[i]
  await clickNav(label)
  const href = await activeHref()
  const bodyLen = await page.evaluate(() => document.querySelector('main')?.textContent?.trim().length ?? 0)
  await shot(`visual-step2-${i+1}-${label.replace(/\s/g,'')}`)
  step2results.push({ label, activeHref: href, bodyLen })
}
probes['step2-routing'] = step2results
writeFileSync(resolve(PROBE_DIR, 'step2-routing.json'), JSON.stringify(step2results, null, 2))
// final active state
await probe('step2-final', () => Array.from(document.querySelectorAll('nav a')).map(a => ({
  text: a.textContent?.trim(), href: a.getAttribute('href'),
  active: a.classList.contains('active') || a.getAttribute('aria-current') === 'page',
})))

// ---------- STEP 3: No element bleeds — analyze arrow ----------
console.log('STEP 3: Analyze arrow containment')
await clickNav('Analyze')
await wait(500)
await page.locator('[data-testid="pgn-input"]').fill(OPERA_PGN)
await page.getByRole('button', { name: /Load PGN/i }).click()
await page.locator('[data-testid="chess-board"]').first().waitFor({ state: 'visible', timeout: 10000 })
await wait(600)
// Scrub to ply 1 (1.e4) so the arrow renders (currentPly > 0)
await page.locator('[data-testid="scrubber"] button', { hasText: '▶' }).first().click()
await wait(900)
await shot('visual-step3-arrow')
await probe('step3-arrow-containment', () => {
  const svg = document.querySelector('[data-testid="board-arrows"]')
  const board = document.querySelector('[data-testid="chess-board"]')
  if (!svg || !board) return { error: 'missing element', hasSvg: !!svg, hasBoard: !!board }
  const s = svg.getBoundingClientRect()
  const b = board.getBoundingClientRect()
  const eps = 2
  const contained =
    s.x >= b.x - eps && s.y >= b.y - eps &&
    s.right <= b.right + eps && s.bottom <= b.bottom + eps
  return {
    svg: { x: s.x, y: s.y, w: s.width, h: s.height, right: s.right, bottom: s.bottom },
    board: { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom },
    contained,
  }
})
await probe('step3-viewport-overlays', () => {
  const vw = window.innerWidth, vh = window.innerHeight
  const svgs = Array.from(document.querySelectorAll('svg')).map(sv => {
    const r = sv.getBoundingClientRect()
    return {
      testid: sv.getAttribute('data-testid'),
      x: r.x, y: r.y, w: r.width, h: r.height,
      spansFullViewport: r.x <= 1 && r.y <= 1 && r.right >= vw - 1 && r.bottom >= vh - 1,
    }
  })
  return { svgs, viewport: { w: vw, h: vh }, anyFullViewportSvg: svgs.some(s => s.spansFullViewport) }
})

// ---------- STEP 4: Eval bar containment ----------
console.log('STEP 4: Eval bar containment')
await shot('visual-step4-evalbar')
await probe('step4-evalbar-containment', () => {
  const bar = document.querySelector('[data-testid="eval-bar"]')
  const board = document.querySelector('[data-testid="chess-board"]')
  if (!bar || !board) return { error: 'missing', hasBar: !!bar, hasBoard: !!board }
  const eb = bar.getBoundingClientRect()
  const bd = board.getBoundingClientRect()
  const adjacentLeft = Math.abs(eb.right - bd.x) <= 12
  const adjacentRight = Math.abs(eb.x - bd.right) <= 12
  return {
    evalbar: { x: eb.x, y: eb.y, w: eb.width, h: eb.height, right: eb.right, bottom: eb.bottom },
    board: { x: bd.x, y: bd.y, w: bd.width, h: bd.height, right: bd.right, bottom: bd.bottom },
    adjacentLeft, adjacentRight,
    adjacent: adjacentLeft || adjacentRight,
    withinViewport: eb.x >= 0 && eb.y >= 0 && eb.right <= window.innerWidth && eb.bottom <= window.innerHeight,
  }
})

// ---------- STEP 5: Move list containment ----------
console.log('STEP 5: Move list containment')
await shot('visual-step5-movelist')
await probe('step5-movelist-containment', () => {
  const moveList = document.querySelector('[data-testid="move-list"]')
  const board = document.querySelector('[data-testid="chess-board"]')
  if (!moveList || !board) return { error: 'missing', hasMoveList: !!moveList, hasBoard: !!board }
  const ml = moveList.getBoundingClientRect()
  const bd = board.getBoundingClientRect()
  const allBadgeEls = Array.from(document.querySelectorAll('[data-testid="move-list"] *')).filter(el => {
    const t = el.textContent?.trim() ?? ''
    return ['??','‼','?!','?','!','✓','☆','★'].includes(t)
  }).map(el => {
    const r = el.getBoundingClientRect()
    const contained = r.x >= ml.x && r.y >= ml.y && r.right <= ml.right && r.bottom <= ml.bottom
    return { text: el.textContent?.trim(), contained, x: r.x, y: r.y, w: r.width, h: r.height }
  })
  return {
    moveList: { x: ml.x, y: ml.y, w: ml.width, h: ml.height, right: ml.right, bottom: ml.bottom },
    board: { x: bd.x, y: bd.y, w: bd.width, h: bd.height, right: bd.right, bottom: bd.bottom },
    moveListRightOfBoard: ml.x >= bd.right - 2,
    overlapsBoard: ml.x < bd.right && ml.right > bd.x,
    badgeCount: allBadgeEls.length,
    badges: allBadgeEls,
    allBadgesContained: allBadgeEls.every(b => b.contained),
  }
})

// ---------- STEP 6: Toasts / error containment ----------
console.log('STEP 6: Error containment')
await page.locator('[data-testid="pgn-input"]').fill('invalid pgn garbage 1. z9 z9')
await page.getByRole('button', { name: /Load PGN/i }).click()
await wait(1000)
await shot('visual-step6-error')
await probe('step6-error-containment', () => {
  const error = document.querySelector('[data-testid="analyze-error"], [role="alert"]')
  if (!error) return { error: 'no error element shown', hasRoleAlert: !!document.querySelector('[role="alert"]') }
  const r = error.getBoundingClientRect()
  return {
    error: { x: r.x, y: r.y, w: r.width, h: r.height, text: error.textContent?.trim()?.slice(0,80) },
    withinViewport: r.x >= 0 && r.y >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  }
})

// ---------- STEP 6b: Play page — check no full-viewport overlay ----------
console.log('STEP 6b: Play page overlays')
await clickNav('Play')
await wait(1200)
await shot('visual-step6b-play')
await probe('step6b-play-overlays', () => {
  const vw = window.innerWidth, vh = window.innerHeight
  const fixed = Array.from(document.querySelectorAll('body *')).filter(el => {
    const cs = getComputedStyle(el)
    if (cs.position !== 'fixed') return false
    const r = el.getBoundingClientRect()
    return r.width > 50 && r.height > 20
  }).map(el => {
    const r = el.getBoundingClientRect()
    return {
      tag: el.tagName, testid: el.getAttribute('data-testid'),
      x: r.x, y: r.y, w: r.width, h: r.height,
      spansFullViewport: r.x <= 1 && r.y <= 1 && r.right >= vw-1 && r.bottom >= vh-1,
    }
  })
  return { fixedCount: fixed.length, fixed, viewport: { w: vw, h: vh } }
})

writeFileSync(resolve(PROBE_DIR, 'all-probes.json'), JSON.stringify(probes, null, 2))
await browser.close()
console.log('DONE')
