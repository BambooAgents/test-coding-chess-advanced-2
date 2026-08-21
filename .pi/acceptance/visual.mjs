// Visual glitch detector: checks for overlapping/clipped/offscreen elements per page.
import { chromium } from '@playwright/test'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const pages = ['', 'play', 'analyze', 'puzzles', 'weaknesses']
for (const p of pages) {
  await page.goto(BASE + p, { waitUntil: 'domcontentloaded' })
  await sleep(1500)
  const res = await page.evaluate(() => {
    const els = Array.from(document.body.querySelectorAll('*'))
    let offscreen = 0, zeroSize = 0, clipped = 0, overlap = 0
    const rects = []
    for (const el of els) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      if (r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight + 200) offscreen++
      const st = getComputedStyle(el)
      if (st.overflow !== 'visible') {
        // check scroll overflow
        if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
          // only count visible containers
          if (r.width > 50 && r.height > 20) clipped++
        }
      }
      if (st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0) {
        rects.push({ x: r.x, y: r.y, w: r.width, h: r.height, tag: el.tagName, cls: el.className?.toString?.()?.slice(0,40) })
      }
    }
    // simple overlap check among block-level visible elements with text
    const textEls = Array.from(document.body.querySelectorAll('button, a, span, div, h1, h2, label, p'))
      .map(e => ({ el: e, r: e.getBoundingClientRect(), text: e.innerText?.slice(0,20) }))
      .filter(o => o.text && o.r.width > 20 && o.r.height > 12)
    let textOverlaps = 0
    const overlapPairs = []
    for (let i = 0; i < textEls.length; i++) {
      for (let j = i+1; j < textEls.length; j++) {
        const a = textEls[i].r, b = textEls[j].r
        // neither contains the other, and they overlap significantly
        const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
        if (ox > 15 && oy > 8) {
          const containsAinB = b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom
          const containsBinA = a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom
          if (!containsAinB && !containsBinA) {
            textOverlaps++
            if (overlapPairs.length < 5) overlapPairs.push({ a: textEls[i].text, b: textEls[j].text, ax: Math.round(a.x), ay: Math.round(a.y), bx: Math.round(b.x), by: Math.round(b.y) })
          }
        }
      }
    }
    return { offscreen, clipped, textOverlaps, overlapPairs, title: document.title, bodyLen: document.body.innerText.length }
  })
  console.log('PAGE', JSON.stringify(p), JSON.stringify(res))
}
await browser.close()
console.log('DONE')
