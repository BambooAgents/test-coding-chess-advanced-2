// Re-review Playwright driver — Swarm 4 My Weaknesses fixes.
// Text-only reviewer (GLM-5.2) orchestrates; this script drives Playwright,
// screenshots each step, and dumps DOM/console data for cross-reference.
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'
const SHOT = (n) => `.pi/acceptance/swarm4/screenshots/weaknesses-rereview-step${n}.png`

const consoleMessages = []
const pageErrors = []

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } })
const page = await ctx.newPage()

page.on('console', (m) => {
  consoleMessages.push({ type: m.type(), text: m.text(), loc: m.location()?.url })
})
page.on('pageerror', (e) => pageErrors.push(String(e)))

const dump = {}

// ---------- Step 1: Initial Weaknesses page ----------
await page.goto(`${BASE}/weaknesses`, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.screenshot({ path: SHOT(1), fullPage: true })

dump.step1 = await page.evaluate(() => {
  const input = document.querySelector('#username')
  const button = document.querySelector('button')
  const title = document.querySelector('h1')?.textContent
  const subtitle = document.querySelector('p')?.textContent
  return {
    url: location.href,
    title,
    subtitle,
    hasUsernameInput: !!input,
    inputType: input?.type,
    buttonLabel: button?.textContent?.trim(),
    bodyTextSample: document.body.innerText.slice(0, 400),
  }
})

// ---------- Step 2: Load real games for 'hikaru' ----------
await page.fill('#username', 'hikaru')
// Keep 20 games (default option already = 20)
await page.screenshot({ path: SHOT('2-pre'), fullPage: true })
await page.click('button')
// wait for fetching -> analyzing -> done. Analysis of 20 games with stockfish may take a while.
// Poll up to ~180s for "Analysis complete".
let step2done = false
const t0 = Date.now()
let lastProgress = ''
while (Date.now() - t0 < 180000) {
  const txt = await page.evaluate(() => document.body.innerText.slice(0, 3000))
  if (/Analysis complete/i.test(txt)) { step2done = true; lastProgress = txt; break }
  if (/Error/i.test(txt) && /error/i.test(txt) && !/Analyzing/i.test(txt)) {
    // could be error state
    lastProgress = txt
  }
  await page.waitForTimeout(2500)
}
await page.screenshot({ path: SHOT(2), fullPage: true })

dump.step2 = await page.evaluate(() => {
  const txt = document.body.innerText
  const progressMatch = txt.match(/Analyzing game (\d+) of (\d+)/i)
  const completeMatch = txt.match(/Analysis complete:\s*(\d+)\s*game/i)
  return {
    analysisComplete: !!completeMatch,
    completedGames: completeMatch ? completeMatch[1] : null,
    totalGames: completeMatch ? completeMatch[2] : null,
    stillAnalyzing: !!progressMatch,
    progressLine: progressMatch ? progressMatch[0] : null,
    errorVisible: /error/i.test(txt) && !/Analyzing/i.test(txt),
    bodyTextHead: txt.slice(0, 800),
  }
})

// ---------- Step 3: Recommendations render (B1=N1 territory) ----------
await page.waitForTimeout(500)
await page.screenshot({ path: SHOT(3), fullPage: true })

dump.step3 = await page.evaluate(() => {
  // Openings table
  const tables = Array.from(document.querySelectorAll('table'))
  const openingsTable = tables.find((t) => /Opening/i.test(t.innerText))
  let openingRows = []
  if (openingsTable) {
    openingRows = Array.from(openingsTable.querySelectorAll('tbody tr')).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim()),
    )
  }
  // Recommendations
  const recCards = Array.from(document.querySelectorAll('div')).filter((d) =>
    /Train\s|Reduce blunders/i.test(d.innerText) && d.innerText.length < 600,
  )
  // Grab rec titles + links
  const recs = Array.from(document.querySelectorAll('a')).filter((a) =>
    /Train →/.test(a.textContent || ''),
  ).map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href') }))
  // SeverityBadge
  const sevBadges = Array.from(document.querySelectorAll('*')).filter((el) =>
    /^(HIGH|MEDIUM|LOW)$/.test(el.textContent.trim()),
  ).map((el) => el.textContent.trim())
  return {
    openingRowsCount: openingRows.length,
    openingRows,
    recsCount: recs.length,
    recs,
    sevBadges: sevBadges.slice(0, 20),
  }
})

// ---------- B1 verdict probe: no 'Unknown' in openings; some real names ----------
dump.b1openings = await page.evaluate(() => {
  const tables = Array.from(document.querySelectorAll('table'))
  const openingsTable = tables.find((t) => /Opening/i.test(t.innerText))
  if (!openingsTable) return { found: false, rows: [] }
  const rows = Array.from(openingsTable.querySelectorAll('tbody tr')).map((tr) => {
    const cells = Array.from(tr.querySelectorAll('td')).map((td) => td.innerText.trim())
    return { name: cells[0], eco: cells[1], perspective: cells[2], games: cells[3] }
  })
  const unknownCount = rows.filter((r) => /^Unknown$/i.test(r.name)).length
  const names = rows.map((r) => r.name)
  return { found: true, rows, unknownCount, names }
})

// ---------- N1 verdict probe: console warnings mentioning 'severity' ----------
dump.n1console = {
  totalMessages: consoleMessages.length,
  severityWarnings: consoleMessages.filter((m) => /severity/i.test(m.text)),
  styledComponentsWarnings: consoleMessages.filter((m) => /styled-components|unknown prop|transient|warning/i.test(m.text)),
  pageErrors,
}

// ---------- I1 verdict: navigate to /puzzles?set=indian-game-spielmann-indian-variation ----------
await page.goto(`${BASE}/puzzles?set=indian-game-spielmann-indian-variation`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.screenshot({ path: SHOT(4), fullPage: true })

dump.i1puzzles = await page.evaluate(() => {
  const txt = document.body.innerText
  // Detect themed vs plain: themed mode shows opening picker / theme UI; plain shows "Plain"/"Themed" with plain active.
  // Look for active mode button.
  const modeButtons = Array.from(document.querySelectorAll('button')).map((b) => ({
    text: b.textContent.trim(),
    active: /active/i.test(b.getAttribute('class') || '') || /var\(--accent\)/i.test(b.getAttribute('style') || '') || b.getAttribute('$active') === 'true',
  }))
  // Try to detect theme type indicators
  const hasOpeningPicker = /opening/i.test(txt) && /Sicilian|Indian|King's Pawn|Queen's Pawn|French|Caro|Ruy|Italian/i.test(txt)
  return {
    url: location.href,
    search: location.search,
    modeButtons: modeButtons.slice(0, 12),
    hasOpeningPicker,
    bodyTextHead: txt.slice(0, 600),
  }
})

// Also explicitly probe the mode state via DOM that the code sets.
// The code: setMode('themed'); setThemeType('opening'); setSelectedTheme(null|match)
// After fall-back, selectedTheme = null, themeType = 'opening' → UI shows opening picker list.
// Look for "Themed" button active and opening list visible.
dump.i1mode = await page.evaluate(() => {
  // Find buttons whose text is one of the mode labels
  const buttons = Array.from(document.querySelectorAll('button'))
  const modes = {}
  for (const b of buttons) {
    const t = b.textContent.trim()
    if (/^Plain$|^Themed$|^Rush$|^Death/i.test(t)) {
      // styled-components $active doesn't appear in DOM; check computed bg? Simpler: count occurrences & pick.
      modes[t] = (modes[t] || 0) + 1
    }
  }
  // The themed mode renders an opening picker list (buttons with opening names)
  const openingButtons = buttons.filter((b) => {
    const t = b.textContent.trim()
    return /^(Sicilian|Indian|King's Pawn|Queen's Pawn|French|Caro|Ruy|Italian|Scandinavian|Pirc|Slav|English)/.test(t)
  }).map((b) => b.textContent.trim())
  return { modeButtonCounts: modes, openingButtons: openingButtons.slice(0, 30) }
})

// ---------- Write dump ----------
writeFileSync('.pi/acceptance/swarm4/rereview-dump.json', JSON.stringify(dump, null, 2))
writeFileSync('.pi/acceptance/swarm4/rereview-console.json', JSON.stringify(consoleMessages, null, 2))

console.log('=== STEP1 ===')
console.log(JSON.stringify(dump.step1, null, 2))
console.log('=== STEP2 ===')
console.log(JSON.stringify(dump.step2, null, 2))
console.log('=== STEP3 ===')
console.log(JSON.stringify(dump.step3, null, 2))
console.log('=== B1 ===')
console.log(JSON.stringify(dump.b1openings, null, 2))
console.log('=== N1 ===')
console.log(JSON.stringify(dump.n1console, null, 2))
console.log('=== I1 ===')
console.log(JSON.stringify(dump.i1puzzles, null, 2))
console.log('=== I1 mode ===')
console.log(JSON.stringify(dump.i1mode, null, 2))

await browser.close()
console.log('DONE')
