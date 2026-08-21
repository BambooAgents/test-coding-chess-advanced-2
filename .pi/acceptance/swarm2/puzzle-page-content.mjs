// Capture the actual puzzle rendered: FEN, rating, themes, whose-turn, from the Puzzles page DOM.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
await page.goto(BASE + 'puzzles', { waitUntil: 'load' })
try { await page.waitForSelector('main', { timeout: 8000 }) } catch {}
await page.waitForTimeout(1000)
const info = await page.evaluate(() => {
  const text = document.body.innerText
  return {
    bodyText: text.slice(0, 800),
    ratingPresent: /rating|Rating|\b\d{3,4}\b/.test(text),
    themeWords: text.match(/\b(advantage|mate|crushing|endgame|middlegame|opening|fork|pin|skewer|discoveredAttack|zugzwang|backRank|smothered|quietMove)\b/gi) || [],
    turnIndicator: text.match(/(your turn|to move|white to move|black to move)/i)?.[0] || null,
    buttons: Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()),
  }
})
console.log(JSON.stringify(info, null, 2))
writeFileSync('.pi/acceptance/swarm2/puzzle-page-content.json', JSON.stringify(info, null, 2))
await browser.close()
