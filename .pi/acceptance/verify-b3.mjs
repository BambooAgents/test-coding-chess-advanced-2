import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
// Opera Game — ends in checkmate (17.Rd8#), perfect for testing the B3 mate-hang fix
const IMMORTAL = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text().slice(0,200)); });
page.on('pageerror', err => console.log('PAGE ERR:', err.message.slice(0,200)));

await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Fill PGN via testid
const ta = page.locator('[data-testid="pgn-input"]');
console.log('textarea count:', await ta.count());
await ta.fill(IMMORTAL);
await page.waitForTimeout(300);

// Click Load PGN (auto-starts analysis)
await page.locator('button:has-text("Load PGN")').click();
console.log('clicked Load PGN');
await page.waitForTimeout(1000);

// Monitor progress via the analyzing testid
const start = Date.now();
let lastProgress = '';
let completed = false;
const totalMoves = 33; // Opera game = 33 plies
while (Date.now() - start < 240000) {  // 4 min max
  await page.waitForTimeout(3000);
  const analyzingVisible = await page.locator('[data-testid="analyzing"]').count();
  const accuracyVisible = await page.locator('[data-testid="accuracy"]').count();
  let progress = '?';
  if (analyzingVisible > 0) {
    const text = await page.locator('[data-testid="analyzing"]').innerText();
    progress = 'analyzing: ' + text.trim();
  } else if (accuracyVisible > 0) {
    completed = true;
    progress = 'DONE (accuracy visible)';
  } else {
    progress = 'idle (no analyzing, no accuracy)';
  }
  if (progress !== lastProgress) {
    console.log(`${((Date.now()-start)/1000).toFixed(0)}s: ${progress}`);
    lastProgress = progress;
  }
  if (completed) break;
}

await page.screenshot({ path: '.pi/acceptance/screenshots/analyze-immortal-result.png' });
console.log(`VERDICT: analysis ${completed ? 'COMPLETED' : 'HUNG/TIMEOUT'} after ${((Date.now()-start)/1000).toFixed(0)}s`);
await browser.close();
