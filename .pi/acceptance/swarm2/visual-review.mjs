// Visual review sweep: navigate to every page, screenshot (desktop + responsive),
// and run a DOM computed-style audit. Vision-checker subagents are dispatched
// separately by the orchestrator after this script produces screenshots + audit JSON.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const OUT_DIR = '.pi/acceptance/swarm2/screenshots'
const AUDIT_PATH = '.pi/acceptance/swarm2/dom-audit.json'

mkdirSync(OUT_DIR, { recursive: true })

const pages = [
  { name: 'home', path: '' },
  { name: 'play', path: 'play' },
  { name: 'analyze', path: 'analyze' },
  { name: 'puzzles', path: 'puzzles' },
  { name: 'weaknesses', path: 'weaknesses' },
]

// Playwright select which path indicates the page rendered
const readySelectors = {
  home: 'main',
  play: 'main',
  analyze: 'main',
  puzzles: 'main',
  weaknesses: 'main',
}

async function shot(page, name, width, height) {
  const file = join(OUT_DIR, `${name}.png`)
  await page.setViewportSize({ width, height })
  await page.screenshot({ path: file, fullPage: true })
  return file
}

async function domAudit(page, name) {
  return await page.evaluate((nm) => {
    const out = { page: nm, transparentText: [], zeroHeight: [], offScreen: [], tinyText: [] }
    const all = document.querySelectorAll('body *')
    const vw = window.innerWidth
    const vh = window.innerHeight
    for (const el of all) {
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      // transparent text color
      if (cs.color === 'rgba(0, 0, 0, 0)' && el.textContent && el.textContent.trim()) {
        out.transparentText.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent.trim().slice(0, 60),
          cls: el.className?.toString?.().slice(0, 60),
        })
      }
      // 0px height with text content
      if (r.height === 0 && el.textContent && el.textContent.trim() && cs.display !== 'none') {
        out.zeroHeight.push({
          tag: el.tagName.toLowerCase(),
          text: el.textContent.trim().slice(0, 60),
          cls: el.className?.toString?.().slice(0, 60),
        })
      }
      // off-screen (fully beyond viewport, ignoring sticky header)
      if (r.width > 0 && r.height > 0) {
        if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh + 4000) {
          out.offScreen.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().slice(0, 40),
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          })
        }
      }
      // tiny text under 8px that is visible
      const fs = parseFloat(cs.fontSize)
      if (fs > 0 && fs < 8 && r.width > 0 && r.height > 0) {
        out.tinyText.push({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 40),
          fontSize: cs.fontSize,
        })
      }
    }
    out.counts = {
      transparentText: out.transparentText.length,
      zeroHeight: out.zeroHeight.length,
      offScreen: out.offScreen.length,
      tinyText: out.tinyText.length,
    }
    return out
  }, name)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const results = { desktop: {}, responsive: {}, audits: {} }

for (const p of pages) {
  const url = BASE + p.path
  console.log(`-> ${p.name}: ${url}`)
  await page.goto(url, { waitUntil: 'load' })
  // wait for main content container
  try {
    await page.waitForSelector(readySelectors[p.name], { timeout: 8000 })
  } catch (e) {
    console.log(`  ! selector timeout for ${p.name}`)
  }
  // give styled-components + fonts a moment
  await page.waitForTimeout(600)
  const file = await shot(page, p.name, 1280, 900)
  results.desktop[p.name] = file
  const audit = await domAudit(page, p.name)
  results.audits[p.name] = audit
  console.log(`  desktop shot: ${file} | audit counts:`, audit.counts)
}

// Responsive sweep at 768px width
for (const p of pages) {
  const url = BASE + p.path
  console.log(`-> responsive ${p.name}: ${url}`)
  await page.goto(url, { waitUntil: 'load' })
  try {
    await page.waitForSelector(readySelectors[p.name], { timeout: 8000 })
  } catch (e) {
    console.log(`  ! selector timeout for ${p.name}`)
  }
  await page.waitForTimeout(600)
  const file = await shot(page, `${p.name}-768`, 768, 1024)
  results.responsive[p.name] = file
  console.log(`  responsive shot: ${file}`)
}

writeFileSync(AUDIT_PATH, JSON.stringify(results.audits, null, 2))
writeFileSync('.pi/acceptance/swarm2/visual-review-results.json', JSON.stringify(results, null, 2))
console.log('\nDONE')
console.log('Audit:', AUDIT_PATH)
await browser.close()
