// Decisive I1 probe: confirm themed mode is active (not plain) after ?set=indian-game-spielmann-indian-variation
import { chromium } from 'playwright'
import { writeFileSync } from 'fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1600 } })).newPage()

await page.goto(`${BASE}/puzzles?set=indian-game-spielmann-indian-variation`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)

// Capture the search param BEFORE it's cleared by the effect, plus DOM evidence of themed mode.
// The effect clears the param via setSearchParams({}, {replace:true}) after consumption.
const probe = await page.evaluate(() => {
  // The ThemeSelector block (ENDGAME SETS / OPENING SETS) is rendered ONLY when mode==='themed'.
  const themeSelectorText = ['ENDGAME SETS', 'OPENING SETS', 'All Endgames']
  const bodyText = document.body.innerText
  const hasEndgameSetsHeader = bodyText.includes('ENDGAME SETS')
  const hasOpeningSetsHeader = bodyText.includes('OPENING SETS')
  // Plain mode renders neither; it shows puzzle board directly with no theme picker.
  // Count opening chips:
  const openingChips = Array.from(document.querySelectorAll('button')).filter((b) =>
    b.closest('div') && /OPENING SETS/i.test(b.closest('div').innerText),
  ).length
  // Detect plain-mode-only UI: the puzzle board with FEN/side-to-move
  const plainOnly = bodyText.includes('Side to move') || bodyText.includes('Your move')
  // Capture the current puzzleLink-driven slug from a hidden probe: re-read history state
  return {
    finalUrl: location.href,
    finalSearch: location.search,
    hasEndgameSetsHeader,
    hasOpeningSetsHeader,
    openingChipsCount: openingChips,
    plainOnlyMarker: plainOnly,
  }
})

writeFileSync('.pi/acceptance/swarm4/i1-probe.json', JSON.stringify(probe, null, 2))
console.log(JSON.stringify(probe, null, 2))

await browser.close()
