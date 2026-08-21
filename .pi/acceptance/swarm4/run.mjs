import { chromium } from 'playwright';

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const SHOT = (n) => `/home/bamboo/pi/projects/coding/test-coding-chess-advanced-2/.pi/acceptance/swarm4/screenshots/analyze-step${n}.png`;

const PGN = `1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ *`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const probe = async (code) => page.evaluate(code);

async function waitForReady() {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(1500); await page.click('a[href*="/analyze"]'); await page.waitForTimeout(1500);
  // wait for root to render
  await page.waitForSelector('#root', { timeout: 15000 });
  // give the app a moment to mount
  await page.waitForTimeout(1200);
}

await waitForReady();
console.log('STEP1: load page + paste PGN');

// Step 1: paste PGN and click Load PGN
await page.fill('[data-testid="pgn-input"]', PGN);
await page.click('button:has-text("Load PGN")');

// Wait for move-list to populate (game loads). Poll up to 20s.
let moveListCount = 0;
for (let i = 0; i < 40; i++) {
  moveListCount = await page.evaluate(() => document.querySelectorAll('[data-testid="move-list"] [data-ply]').length);
  if (moveListCount > 0) break;
  await page.waitForTimeout(500);
}
console.log('move-list rows after load:', moveListCount);

// capture step1 state via DOM probe (non-visual)
const step1Dom = await page.evaluate(() => {
  const ml = document.querySelector('[data-testid="move-list"]');
  const board = document.querySelector('[data-testid="chess-board"]');
  const opening = document.querySelector('body')?.innerText.match(/Opening|Unknown opening/i);
  const err = document.querySelector('[data-testid="analyze-error"]');
  const rows = ml ? Array.from(ml.querySelectorAll('[data-ply]')).map(r => r.getAttribute('data-ply') + ':' + r.innerText.replace(/\s+/g,' ').trim()) : [];
  const movesText = ml ? ml.innerText.replace(/\s+/g,' ').trim() : '';
  return {
    moveListExists: !!ml,
    boardExists: !!board,
    rowCount: rows.length,
    rows: rows,
    movesText: movesText.slice(0,500),
    errorVisible: !!err,
    errorText: err ? err.innerText : null,
  };
});
console.log('STEP1 DOM:', JSON.stringify(step1Dom, null, 2));
await page.screenshot({ path: SHOT(1), fullPage: true });

// Step 2: wait for analysis to complete (analyzing signal gone, accuracy appears)
console.log('STEP2: wait for analysis completion');
let analyzingGone = false, accuracyPresent = false;
let analyzingHadSignal = false;
for (let i = 0; i < 80; i++) {
  const state = await page.evaluate(() => {
    const an = document.querySelector('[data-testid="analyzing"]');
    const acc = document.querySelector('[data-testid="accuracy"]');
    const cancel = document.querySelector('[data-testid="cancel-analysis"]');
    return {
      analyzingVisible: an ? !!(an.offsetParent || an.getClientRects().length) : false,
      analyzingText: an ? an.innerText : null,
      cancelVisible: cancel ? !!(cancel.offsetParent || cancel.getClientRects().length) : false,
      accVisible: acc ? !!(acc.offsetParent || acc.getClientRects().length) : false,
      accText: acc ? acc.innerText : null,
    };
  });
  if (state.analyzingVisible) analyzingHadSignal = true;
  if (analyzingHadSignal && !state.analyzingVisible && state.accVisible) {
    analyzingGone = true; accuracyPresent = true;
    console.log('analysis done at iter', i, 'acc:', state.accText);
    break;
  }
  if (i % 5 === 0) console.log('  waiting iter', i, 'analyzing:', state.analyzingVisible, state.analyzingText, 'acc:', state.accVisible);
  await page.waitForTimeout(500);
}
const step2Dom = await page.evaluate(() => {
  const an = document.querySelector('[data-testid="analyzing"]');
  const acc = document.querySelector('[data-testid="accuracy"]');
  const ml = document.querySelector('[data-testid="move-list"]');
  const badges = ml ? Array.from(ml.querySelectorAll('span')).filter(s => {
    const t = s.innerText.trim();
    return t === '!!' || t === '!' || t === '?!' || t === '?' || t === '??' || t === '♭' || t === '';
  }) : [];
  // count badge spans by classification glyph
  const allBadgeSpans = ml ? Array.from(ml.querySelectorAll('[data-ply] span')).map(s => s.innerText.trim()).filter(Boolean) : [];
  const evalBar = document.querySelector('[data-testid="eval-bar"]');
  return {
    analyzingVisible: an ? !!(an.offsetParent) : false,
    analyzingText: an ? an.innerText : null,
    accVisible: acc ? !!(acc.offsetParent) : false,
    accText: acc ? acc.innerText : null,
    badgeGlyphs: allBadgeSpans,
    evalBarExists: !!evalBar,
    evalBarRect: evalBar ? (() => { const r = evalBar.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height};})() : null,
  };
});
console.log('STEP2 DOM:', JSON.stringify(step2Dom, null, 2));
console.log('analyzingHadSignal:', analyzingHadSignal, 'analyzingGone:', analyzingGone, 'accuracyPresent:', accuracyPresent);
await page.screenshot({ path: SHOT(2), fullPage: true });

// Step 3: scrub to ply 1 (1.e4) - click the forward scrub once from ply 0, OR click move 1 row
// First check current ply
const cur0 = await page.evaluate(() => {
  const s = document.querySelector('[data-testid="scrubber"]');
  return s ? s.innerText : null;
});
console.log('scrubber before step3:', cur0);
// click move 1 row (data-ply="1")
await page.click('[data-testid="move-list"] [data-ply="1"]');
await page.waitForTimeout(800);
const step3Dom = await page.evaluate(() => {
  const board = document.querySelector('[data-testid="chess-board"]');
  const svg = document.querySelector('[data-testid="board-arrows"]');
  const scrubber = document.querySelector('[data-testid="scrubber"]');
  const evalBar = document.querySelector('[data-testid="eval-bar"]');
  const row1 = document.querySelector('[data-testid="move-list"] [data-ply="1"]');
  const badgeSpan = row1 ? row1.querySelector('span:last-child') : null;
  function rect(e){ if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}
  const s = rect(svg); const b = rect(board);
  let contained = null;
  if (s && b) {
    contained = s.x >= b.x && s.y >= b.y && s.right <= b.right && s.bottom <= b.bottom;
  }
  // eval bar containment in board area? check vs board
  return {
    scrubberText: scrubber ? scrubber.innerText : null,
    row1Text: row1 ? row1.innerText.replace(/\s+/g,' ').trim() : null,
    row1BadgeText: badgeSpan ? badgeSpan.innerText.trim() : null,
    row1BadgeClass: badgeSpan ? badgeSpan.className : null,
    svgPresent: !!svg,
    boardRect: b,
    svgRect: s,
    svgContainedInBoard: contained,
    svgWidth: s ? s.w : null,
    svgHeight: s ? s.h : null,
    evalBarRect: rect(evalBar),
  };
});
console.log('STEP3 DOM:', JSON.stringify(step3Dom, null, 2));
await page.screenshot({ path: SHOT(3), fullPage: true });

// Step 4: scrub to ply 19 (10.Nxb5) - click data-ply="19"
await page.click('[data-testid="move-list"] [data-ply="19"]');
await page.waitForTimeout(1000);
const step4Dom = await page.evaluate(() => {
  const board = document.querySelector('[data-testid="chess-board"]');
  const svg = document.querySelector('[data-testid="board-arrows"]');
  const scrubber = document.querySelector('[data-testid="scrubber"]');
  const ml = document.querySelector('[data-testid="move-list"]');
  const row19 = document.querySelector('[data-testid="move-list"] [data-ply="19"]');
  const badgeSpan = row19 ? row19.querySelector('span:last-child') : null;
  function rect(e){ if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}
  const s = rect(svg); const b = rect(board); const m = rect(ml); const r19 = rect(row19);
  let svgContained = null, badgeContained = null;
  if (s && b) svgContained = s.x >= b.x && s.y >= b.y && s.right <= b.right && s.bottom <= b.bottom;
  if (r19 && m) badgeContained = r19.x >= m.x && r19.y >= m.y && r19.right <= m.right && r19.bottom <= m.bottom;
  // is row19 visible within move-list viewport? (auto-scroll check)
  const mlParent = ml;
  let rowVisibleInView = null;
  if (r19 && m) {
    rowVisibleInView = r19.y >= m.y && r19.bottom <= m.bottom;
  }
  return {
    scrubberText: scrubber ? scrubber.innerText : null,
    row19Text: row19 ? row19.innerText.replace(/\s+/g,' ').trim() : null,
    row19BadgeText: badgeSpan ? badgeSpan.innerText.trim() : null,
    row19BadgeClass: badgeSpan ? badgeSpan.className : null,
    svgPresent: !!svg,
    boardRect: b,
    svgRect: s,
    svgContainedInBoard: svgContained,
    moveListRect: m,
    row19Rect: r19,
    badgeContainedInMoveList: badgeContained,
    row19VisibleInMoveListViewport: rowVisibleInView,
  };
});
console.log('STEP4 DOM:', JSON.stringify(step4Dom, null, 2));
await page.screenshot({ path: SHOT(4), fullPage: true });

// Save all DOM probes to a json for cross-referencing
import { writeFileSync } from 'fs';
writeFileSync('/home/bamboo/pi/projects/coding/test-coding-chess-advanced-2/.pi/acceptance/swarm4/dom-probes.json', JSON.stringify({
  step1: step1Dom, step2: step2Dom, step3: step3Dom, step4: step4Dom,
  meta: { analyzingHadSignal, analyzingGone, accuracyPresent, moveListCount }
}, null, 2));

await browser.close();
console.log('DONE');
