// DOM structure + text + console audit per page (no vision model available at this depth).
// Captures: console errors, page title, nav links, headings, buttons, key text,
// computed style sanity (contrast of text on backgrounds), element counts.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/'
const pages = [
  { name: 'home', path: '' },
  { name: 'play', path: 'play' },
  { name: 'analyze', path: 'analyze' },
  { name: 'puzzles', path: 'puzzles' },
  { name: 'weaknesses', path: 'weaknesses' },
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const results = {}
for (const p of pages) {
  const url = BASE + p.path
  const consoleMsgs = []
  const pageErrors = []
  page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 200) }))
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)))

  await page.goto(url, { waitUntil: 'load' })
  try { await page.waitForSelector('main', { timeout: 8000 }) } catch {}
  await page.waitForTimeout(700)

  const info = await page.evaluate(() => {
    const q = (s) => Array.from(document.querySelectorAll(s))
    const cs = (el) => getComputedStyle(el)
    const nav = q('header nav a').map(a => ({
      text: a.textContent.trim(),
      href: a.getAttribute('href'),
      active: a.classList.contains('active'),
      color: cs(a).color,
      bg: cs(a).backgroundColor,
    }))
    const logo = document.querySelector('header span')?.textContent?.trim() || null
    const headings = q('h1,h2').map(h => ({ tag: h.tagName.toLowerCase(), text: h.textContent.trim().slice(0,80), color: cs(h).color, fontSize: cs(h).fontSize }))
    const buttons = q('button').map(b => ({ text: b.textContent.trim().slice(0,40), disabled: b.disabled, visible: b.getBoundingClientRect().height > 0 }))
    const links = q('main a').map(a => ({ text: a.textContent.trim().slice(0,40), href: a.getAttribute('href') }))
    const textareas = q('textarea').map(t => ({ placeholder: t.placeholder, visible: t.getBoundingClientRect().height > 0, rows: t.rows }))
    const inputs = q('input').map(i => ({ type: i.type, placeholder: i.placeholder, visible: i.getBoundingClientRect().height > 0 }))
    const selects = q('select').map(s => ({ options: Array.from(s.options).map(o=>o.textContent.trim()), visible: s.getBoundingClientRect().height > 0 }))
    const boards = q('[class*="oard"], [class*="board"]').length
    // count piece glyphs (chess unicode)
    const pieceRe = /[\u2654-\u265F]/
    const bodyText = document.body.innerText
    const pieceChars = (bodyText.match(new RegExp(pieceRe, 'g')) || []).length
    // contrast check: sample text elements vs their background
    const contrastIssues = []
    for (const el of q('main *')) {
      const t = el.textContent?.trim()
      if (!t || t.length > 40) continue
      const c = cs(el)
      if (c.display === 'none' || c.visibility === 'hidden') continue
      const r = el.getBoundingClientRect()
      if (r.height === 0 || r.width === 0) continue
      const color = c.color
      const bg = c.backgroundColor
      // flag black-on-black or transparent text that is visible
      if (color === 'rgba(0, 0, 0, 0)') contrastIssues.push({ text: t.slice(0,30), color, bg })
    }
    return {
      title: document.title,
      url: location.href,
      nav, logo, headings, buttons, links, textareas, inputs, selects,
      boardElements: boards,
      pieceCharsInText: pieceChars,
      bodyTextLength: bodyText.length,
      contrastIssues: contrastIssues.slice(0, 10),
      headerBg: cs(document.querySelector('header')).backgroundColor,
      headerColor: cs(document.querySelector('header')).color,
      mainHasContent: document.querySelector('main').children.length > 0,
    }
  })

  results[p.name] = { url, consoleMsgs, pageErrors, info }
  console.log(`\n=== ${p.name} ===`)
  console.log('title:', info.title, '| bodyTextLen:', info.bodyTextLength, '| boardEls:', info.boardElements, '| piecesInText:', info.pieceCharsInText)
  console.log('nav:', JSON.stringify(info.nav.map(n=>n.text+'('+(n.active?'active':'')+')')))
  console.log('headings:', JSON.stringify(info.headings.map(h=>h.tag+':'+h.text)))
  console.log('buttons:', JSON.stringify(info.buttons.map(b=>b.text+(b.disabled?'[disabled]':''))))
  if (info.textareas.length) console.log('textareas:', JSON.stringify(info.textareas))
  if (info.inputs.length) console.log('inputs:', JSON.stringify(info.inputs))
  if (info.selects.length) console.log('selects:', JSON.stringify(info.selects))
  if (info.links.length) console.log('links:', JSON.stringify(info.links))
  if (consoleMsgs.filter(m=>m.type==='error').length) console.log('console errors:', JSON.stringify(consoleMsgs.filter(m=>m.type==='error')))
  if (pageErrors.length) console.log('PAGE ERRORS:', JSON.stringify(pageErrors))
  if (info.contrastIssues.length) console.log('contrast issues:', JSON.stringify(info.contrastIssues))
  page.removeAllListeners('console')
  page.removeAllListeners('pageerror')
}

writeFileSync('.pi/acceptance/swarm2/dom-structure-audit.json', JSON.stringify(results, null, 2))
console.log('\nDONE -> .pi/acceptance/swarm2/dom-structure-audit.json')
await browser.close()
