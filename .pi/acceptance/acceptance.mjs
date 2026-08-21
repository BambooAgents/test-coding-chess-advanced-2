// Acceptance review driver — opens the real app, exercises features, screenshots.
import { chromium } from '@playwright/test'
import fs from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const OUT = '.pi/acceptance/screenshots/'
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function shot(page, name) {
  const path = OUT + name + '.png'
  await page.screenshot({ path, fullPage: true })
  console.log('SHOT', path)
}

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message))

const goto = (url) => page.goto(url, { waitUntil: 'domcontentloaded' })

// ---------- HOME ----------
await goto(BASE)
await sleep(1000)
await shot(page, 'home')

// ---------- PUZZLES ----------
await goto(BASE + 'puzzles')
await sleep(1500)
await shot(page, 'puzzles')
const puzzleText = await page.evaluate(() => document.body.innerText)
console.log('PUZZLES_TEXT_SAMPLE:\n', puzzleText.slice(0, 700))
// grab the board FEN if exposed
const puzzleFen = await page.evaluate(() => {
  const all = document.body.innerText
  return all
})
// Show solution to reveal the "tactic"
try {
  await page.click('text=Show Solution', { timeout: 3000 })
  await sleep(800)
  await shot(page, 'puzzles-solution')
  const solText = await page.evaluate(() => document.body.innerText.slice(0, 800))
  console.log('PUZZLES_AFTER_SOLUTION:\n', solText)
} catch (e) {
  console.log('show-solution click err:', e.message)
}

// ---------- ANALYZE ----------
await goto(BASE + 'analyze')
await sleep(1500)
await shot(page, 'analyze-empty')

const realPgn = `[Event "Hoogovens A Tournament"]
[Site "Wijk aan Zee NED"]
[Date "1999.01.20"]
[Round "4"]
[White "Garry Kasparov"]
[Black "Veselin Topalov"]
[Result "1-0"]
[WhiteElo "2812"]
[BlackElo "2700"]
[ECO "B07"]
[Opening "Pirc"]

1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Be3 Bg7 5. Qd2 c6 6. f3 b5 7. Nge2 Nbd7 8. Bh3 Bb7 9. Ng3 Nh5 10. Be2 Qc7 11. O-O e5 12. dxe5 dxe5 13. Bg5 Qb6 14. Bxb5 Qxb5 15. Nxb5 Nxe4 16. Nxe4 Rxb5 17. Bxe7 Bxe7 18. Qxb5 Nxe7 19. Qe5 Rb8 20. Rfe1 a5 21. b3 Ng6 22. Qe3 Bf6 23. Nd5 Bg7 24. c3 f5 25. Re2 Nf8 26. g3 a4 27. bxa4 Rb3 28. Ra1 Rxa3 29. Rxa3 Bxa3 30. Ra2 Bc5 31. Nb4 Ne6 32. Qe5 Bxb4 33. cxb4 Qd6 34. Qxd6 cxd6 35. Rc1 Kf7 36. Kg2 Ke7 37. Kf2 Kd7 38. Ke3 Kc6 39. Kd3 Kb5 40. Rc8 Nd8 41. Rxd8 1-0`

await page.fill('[data-testid="pgn-input"]', realPgn)
await page.click('text=Load PGN')

let analyzing = true
let waited = 0
while (analyzing && waited < 120) {
  await sleep(1000)
  waited++
  const statusText = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="analyzing"]')
    return el ? el.innerText : null
  })
  if (statusText) {
    if (waited % 5 === 0) console.log('analyze progress:', statusText)
  } else {
    analyzing = false
  }
}
console.log('analyze waited sec:', waited)
await sleep(500)
await shot(page, 'analyze-after')

const accuracy = await page.locator('[data-testid="accuracy"]').count()
console.log('accuracy widget count:', accuracy)
const accuracyText = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="accuracy"]')
  return el ? el.innerText : null
})
console.log('ACCURACY_TEXT:', accuracyText)

const moveListText = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="move-list"]')
  return el ? el.innerText : null
})
console.log('MOVE_LIST_TEXT sample:\n', moveListText ? moveListText.slice(0, 1200) : 'NO MOVE LIST')

const bodyText = await page.evaluate(() => document.body.innerText)
const brilliantCount = (bodyText.match(/!!/g) || []).length
const blunderCount = (bodyText.match(/\?\?/g) || []).length
console.log('brilliant (!!) count:', brilliantCount, 'blunder (??) count:', blunderCount)
const errorBox = await page.locator('[data-testid="analyze-error"]').count()
console.log('analyze-error box count:', errorBox)
if (errorBox) console.log('analyze-error text:', await page.locator('[data-testid="analyze-error"]').innerText())

// ---------- PLAY ----------
await goto(BASE + 'play')
await sleep(2000)
await shot(page, 'play')
const playText = await page.evaluate(() => document.body.innerText.slice(0, 600))
console.log('PLAY_TEXT:\n', playText)

// ---------- WEAKNESSES ----------
await goto(BASE + 'weaknesses')
await sleep(1500)
await shot(page, 'weaknesses')
const weakText = await page.evaluate(() => document.body.innerText.slice(0, 600))
console.log('WEAKNESSES_TEXT:\n', weakText)

console.log('--- CONSOLE ERRORS (' + consoleErrors.length + ') ---')
for (const e of consoleErrors.slice(0, 40)) console.log('ERR:', e)

await browser.close()
console.log('DONE')
