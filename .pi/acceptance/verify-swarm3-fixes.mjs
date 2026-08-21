// Verify the 4 fixes from the hostile review swarm.
import { chromium } from 'playwright'

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = {}

async function testAnalyzeDepthFix() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`${BASE}/analyze`, { waitUntil: 'load' })
  await page.waitForSelector('[data-testid="pgn-input"]')

  // Load the Opera Game PGN that had 1.e4 marked ?!
  const pgn = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+'
  await page.fill('[data-testid="pgn-input"]', pgn)
  await page.click('button:has-text("Load PGN")')

  // Wait for analysis to complete (analyzing indicator disappears)
  const analyzing = await page.$('[data-testid="analyzing"]')
  for (let i = 0; i < 60; i++) {
    const stillAnalyzing = await page.$('[data-testid="analyzing"]')
    if (!stillAnalyzing) break
    await sleep(1000)
  }
  await sleep(1000)

  // Check the move classifications — 1.e4 should NOT be ?! now
  const classifications = await page.$$eval('[data-testid="move-list"] button', (rows) =>
    rows.map((r) => ({
      text: r.textContent.trim(),
      ply: r.getAttribute('data-ply'),
      isCurrent: r.className.includes('accent-soft') || getComputedStyle(r).backgroundColor !== 'rgba(0, 0, 0, 0)',
    })),
  )

  // The first few moves should be book/best/good, NOT ?! inaccuracy
  const first5 = classifications.slice(0, 10)
  console.log('First 10 move rows:', JSON.stringify(first5, null, 2))

  // Check: do any of the first 5 OPENING moves contain ?! ?
  // (moves 1-5: e4, e5, Nf3, d6, d4 — these are the book moves that were marked ?!)
  const openingMoves = classifications.slice(0, 5)
  const hasInaccuracyOnOpening = openingMoves.some((r) => r.text.includes('?!'))
  results.b1_depth = hasInaccuracyOnOpening ? 'FAIL (1.e4 still marked ?!)' : 'PASS (no ?! on opening moves)'
  console.log(`B1 (depth fix): ${results.b1_depth}`)

  // Check I1-Play: PGN textarea should be filled
  const pgnValue = await page.inputValue('[data-testid="pgn-input"]')
  results.i1_pgn_textarea = pgnValue.includes('1. e4') ? 'PASS' : 'FAIL (empty)'
  console.log(`I1 (pgn textarea): ${results.i1_pgn_textarea} — value: "${pgnValue.substring(0, 40)}..."`)

  await browser.close()
}

async function testAnalyzeAutoScroll() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`${BASE}/analyze`, { waitUntil: 'load' })
  await page.waitForSelector('[data-testid="pgn-input"]')

  const pgn = '1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+'
  await page.fill('[data-testid="pgn-input"]', pgn)
  await page.click('button:has-text("Load PGN")')

  // Wait for analysis
  for (let i = 0; i < 60; i++) {
    if (!(await page.$('[data-testid="analyzing"]'))) break
    await sleep(1000)
  }
  await sleep(500)

  // Scrub to ply 19 (move 10.Nxb5)
  // Click the forward button 19 times or find a way to scrub
  for (let i = 0; i < 19; i++) {
    await page.click('button:has-text("▶")')
    await sleep(50)
  }

  await sleep(500)

  // Check the move list scroll position
  const scrollInfo = await page.$eval('[data-testid="move-list"]', (el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }))

  // Check if the current move (ply 19) is visible in the move list
  const currentRowVisible = await page.$$eval('[data-testid="move-list"] button', (rows) => {
    const list = rows[0]?.parentElement?.parentElement
    if (!list) return { found: false }
    const listRect = list.getBoundingClientRect()
    const ply19Row = rows.find((r) => r.getAttribute('data-ply') === '19')
    if (!ply19Row) return { found: false, reason: 'no ply 19 row' }
    const rowRect = ply19Row.getBoundingClientRect()
    const visible = rowRect.top >= listRect.top && rowRect.bottom <= listRect.bottom
    return { found: true, visible, rowTop: rowRect.top, listTop: listRect.top, rowBottom: rowRect.bottom, listBottom: listRect.bottom }
  })

  results.b2_autoscroll = currentRowVisible.visible ? 'PASS (ply 19 row visible)' : `FAIL (ply 19 not visible: ${JSON.stringify(currentRowVisible)})`
  console.log(`B2 (auto-scroll): ${results.b2_autoscroll}`)
  console.log('Scroll info:', JSON.stringify(scrollInfo))

  await browser.close()
}

async function testPlayIllegalFeedback() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(`${BASE}/play`, { waitUntil: 'load' })
  await page.waitForSelector('[data-testid="chess-board"]')

  // Select e2 pawn
  await page.click('[data-square="e2"]')
  await sleep(200)

  // Click d3 (illegal — pawn can't go diagonally without capture)
  await page.click('[data-square="d3"]')
  await sleep(500)

  // Check if a toast appeared
  const pageText = await page.textContent('body')
  const hasIllegalToast = pageText.includes('Illegal move')

  // Also check for any toast/notification element
  const toastElements = await page.$$eval('*', (els) =>
    els.filter((e) => e.textContent?.includes('Illegal move') && getComputedStyle(e).display !== 'none'),
  )

  results.b1_play_illegal = hasIllegalToast ? 'PASS (illegal move toast shown)' : 'FAIL (no toast)'
  console.log(`B1-Play (illegal feedback): ${results.b1_play_illegal}`)

  await browser.close()
}

// Run all tests
console.log('=== Verifying acceptance fixes ===\n')
await testAnalyzeDepthFix()
console.log()
await testAnalyzeAutoScroll()
console.log()
await testPlayIllegalFeedback()
console.log()
console.log('=== Summary ===')
console.log(JSON.stringify(results, null, 2))
