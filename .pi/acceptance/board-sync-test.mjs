import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.locator('textarea').first().fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(13000);

// Scrub to ply 6 (after 3.d4 Bg4 — that's moves 1-6: e4,e5,Nf3,d6,d4,Bg4)
for (let i = 1; i < 6; i++) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => b.textContent?.trim() === '▶');
    if (next) next.click();
  });
  await page.waitForTimeout(200);
}
await page.waitForTimeout(500);

// Check: which move is highlighted, and what's the board position?
const state = await page.evaluate(() => {
  // Find highlighted move row
  const highlighted = document.querySelector('[class*="current"], [data-current="true"]');
  // Get the board squares with pieces
  const board = document.querySelector('[data-testid="chess-board"]');
  const pieces = {};
  if (board) {
    for (const sq of board.children) {
      const square = sq.getAttribute('data-square') || sq.dataset?.square;
      const img = sq.querySelector('img');
      if (square && img) {
        const src = img.src.slice(-6, -4); // e.g. 'wK', 'bP'
        pieces[square] = src;
      }
    }
  }
  // Get the move counter
  const text = document.body.innerText;
  const plyMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
  return { 
    plyCounter: plyMatch ? plyMatch[1] : 'none',
    highlightedMove: highlighted?.textContent?.trim()?.slice(0, 30),
    pieces: pieces,
  };
});
console.log('After scrubbing to ply 6:');
console.log('  plyCounter:', state.plyCounter);
console.log('  highlightedMove:', state.highlightedMove);
console.log('  pieces:', JSON.stringify(state.pieces));
// After 6 plies (e4 e5 Nf3 d6 d4 Bg4), board should have:
// - White pawn on e4, knight on f3, pawn on d4
// - Black pawn on e5, pawn on d6, bishop on g4
console.log('  expected: e4=wP, f3=wN, d4=wP, e5=bP, d6=bP, g4=bB');

await page.screenshot({ path: '.pi/acceptance/board-sync-test.png', fullPage: true });
await browser.close();
