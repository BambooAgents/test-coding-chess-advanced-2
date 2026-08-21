import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.locator('[data-testid="pgn-input"]').fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(12000);

// 1. Find the move list structure
const moveListData = await page.evaluate(() => {
  const body = document.body.innerText;
  // Find all elements containing "!!" (brilliant)
  const brilliantEls = [];
  document.querySelectorAll('*').forEach(el => {
    if (el.children.length === 0 && el.textContent?.includes('!!')) {
      const styles = window.getComputedStyle(el);
      brilliantEls.push({
        tag: el.tagName, class: el.className, text: el.textContent,
        color: styles.color, bg: styles.backgroundColor, fontWeight: styles.fontWeight,
        fontSize: styles.fontSize, rect: el.getBoundingClientRect(),
      });
    }
  });
  return { brilliantEls: brilliantEls.slice(0, 5), brilliantCount: brilliantEls.length };
});
console.log('BRILLIANT ELEMENTS:', JSON.stringify(moveListData, null, 2));

// 2. Scrub to ply 10 (the Nxb5 move) and check arrow
await page.locator('button:has-text("▶"), [data-testid*="next"], button[title*="next"]').first().click().catch(()=>{});
// Try the scrubber
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const next = btns.find(b => b.textContent?.includes('▶'));
  if (next) next.click();
});
await page.waitForTimeout(500);
const arrowAfterScrub = await page.evaluate(() => {
  const arrows = document.querySelectorAll('[data-testid="board-arrows"] svg, [data-testid="board-arrows"]');
  return { arrowEls: arrows.length, html: arrows[0]?.outerHTML?.slice(0, 200) };
});
console.log('ARROW after scrub:', JSON.stringify(arrowAfterScrub));

// 3. Check eval bar fill
const evalBarData = await page.evaluate(() => {
  const bar = document.querySelector('[class*="eval"], [class*="Eval"]');
  if (!bar) return null;
  const fill = bar.querySelector('[class*="fill"], [class*="Fill"], div[style*="height"]');
  return {
    bar: { rect: bar.getBoundingClientRect(), bg: window.getComputedStyle(bar).backgroundColor },
    fill: fill ? { rect: fill.getBoundingClientRect(), bg: window.getComputedStyle(fill).backgroundColor, height: window.getComputedStyle(fill).height } : null,
    innerHTML: bar.innerHTML.slice(0, 300),
  };
});
console.log('EVAL BAR:', JSON.stringify(evalBarData, null, 2));

// 4. Check board piece rendering
const boardData = await page.evaluate(() => {
  const board = document.querySelector('[data-testid="chess-board"]');
  if (!board) return null;
  const squares = board.children;
  const pieces = [];
  for (const sq of squares) {
    const img = sq.querySelector('img');
    if (img) {
      pieces.push({ square: sq.dataset.square || sq.getAttribute('data-square'), img: img.src.slice(-20), rect: sq.getBoundingClientRect() });
    }
  }
  return { squareCount: squares.length, piecesWithImages: pieces.length, firstPieces: pieces.slice(0, 4) };
});
console.log('BOARD:', JSON.stringify(boardData, null, 2));

await page.screenshot({ path: '.pi/acceptance/audit-analyze-scrubbed.png', fullPage: true });
await browser.close();
