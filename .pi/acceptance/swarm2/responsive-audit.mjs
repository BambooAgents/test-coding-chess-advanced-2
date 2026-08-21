// Responsive layout audit: check horizontal overflow at 768px and 390px (mobile).
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const browser = await chromium.launch()
const out = {}

for (const width of [768, 390]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  const page = await ctx.newPage()
  out[width] = {}
  for (const [name, path] of [['home',''],['play','play'],['analyze','analyze'],['puzzles','puzzles'],['weaknesses','weaknesses']]) {
    await page.goto(BASE + path, { waitUntil: 'load' })
    try { await page.waitForSelector('main', { timeout: 8000 }) } catch {}
    await page.waitForTimeout(600)
    const m = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth
      const bodyW = document.body.scrollWidth
      const vw = window.innerWidth
      const nav = document.querySelector('header nav')
      const navR = nav?.getBoundingClientRect()
      const headerR = document.querySelector('header')?.getBoundingClientRect()
      return {
        overflowX: docW > vw,
        docScrollWidth: docW,
        viewportWidth: vw,
        bodyScrollWidth: bodyW,
        navWidth: navR ? Math.round(navR.width) : null,
        navWraps: navR && headerR ? navR.width < headerR.width - 40 : null,
        navHeight: navR ? Math.round(navR.height) : null,
      }
    })
    out[width][name] = m
    console.log(`${width}px ${name}: overflowX=${m.overflowX} docW=${m.docScrollWidth} vw=${m.viewportWidth} navWidth=${m.navWidth} navWraps=${m.navWraps}`)
  }
  await ctx.close()
}

writeFileSync('.pi/acceptance/swarm2/responsive-audit.json', JSON.stringify(out, null, 2))
await browser.close()
