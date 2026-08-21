import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const PUZZLES_URL = BASE + 'puzzles'
const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

await page.goto(PUZZLES_URL)
await page.waitForLoadState('networkidle')
await page.waitForTimeout(1200)

// Switch to themed and enumerate the chips
await page.click('text=Themed Sets')
await page.waitForTimeout(600)

const chips = await page.evaluate(() => {
  const chips = Array.from(document.querySelectorAll('button'))
  return chips.map(b => ({
    text: b.textContent.trim(),
    active: b.className.includes('active') || b.getAttribute('aria-pressed') === 'true',
  })).filter(c => c.text.length > 0 && c.text.length < 60)
})

// Read the feedback banner rendered text precisely (the styled feedback area).
const feedbackProbe = await page.evaluate(() => {
  // The NeutralFeedback renders "White to move — find the best move" / "Black to move — find the best move"
  const all = Array.from(document.querySelectorAll('div'))
  const matches = all.filter(e => {
    const t = e.textContent?.trim()
    return t && /to move — find the best move|Correct|Wrong|Solved|Keep going/.test(t) && t.length < 60
  }).map(e => ({ text: e.textContent.trim(), class: e.className, color: getComputedStyle(e).color }))
  return matches
})

writeFileSync('.pi/acceptance/swarm4/debug-themes.json', JSON.stringify({ chips, feedbackProbe }, null, 2))
console.log(JSON.stringify({ chipsCount: chips.length, firstChips: chips.slice(0, 40), feedbackProbe }, null, 2))
await browser.close()
