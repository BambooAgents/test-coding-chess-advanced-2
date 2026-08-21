// Exercise puzzle modes: Plain, Themed Sets, Rush, Death Match.
import { chromium } from '@playwright/test'
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const OUT = '.pi/acceptance/screenshots/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function shot(page, name) { const path = OUT + name + '.png'; await page.screenshot({ path, fullPage: true }); console.log('SHOT', path); }

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
page.on('console', (m) => console.log('['+m.type()+']', m.text()))
page.on('pageerror', (e) => console.log('[PAGEERR]', e.message))

await page.goto(BASE + 'puzzles', { waitUntil: 'domcontentloaded' })
await sleep(1500)
const modes = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => b.innerText))
console.log('puzzle buttons:', JSON.stringify(modes))

for (const mode of ['Themed Sets', 'Rush', 'Death Match']) {
  try {
    const btn = page.locator('button', { hasText: mode }).first()
    await btn.click({ timeout: 3000 })
    await sleep(1200)
    await shot(page, 'puzzles-' + mode.toLowerCase().replace(/ /g, '-'))
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 600))
    console.log('--- ' + mode + ' ---\n', txt.slice(200))
    // go back to puzzles
    await page.goto(BASE + 'puzzles', { waitUntil: 'domcontentloaded' })
    await sleep(1000)
  } catch (e) { console.log(mode, 'err:', e.message) }
}
await browser.close()
console.log('DONE')
