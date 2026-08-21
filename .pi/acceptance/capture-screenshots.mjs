import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Home
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '.pi/acceptance/audit-home.png', fullPage: true });

// Puzzles
await page.goto(BASE + 'puzzles', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '.pi/acceptance/audit-puzzles.png', fullPage: true });

// Play
await page.goto(BASE + 'play', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '.pi/acceptance/audit-play.png', fullPage: true });

// Weaknesses
await page.goto(BASE + 'weaknesses', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '.pi/acceptance/audit-weaknesses.png', fullPage: true });

// Analyze (loaded with Opera Game, after analysis)
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.locator('[data-testid="pgn-input"]').fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(12000);
await page.screenshot({ path: '.pi/acceptance/audit-analyze.png', fullPage: true });

// Analyze after scrubbing to ply 10 (Nxb5 brilliant move)
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => b.textContent?.includes('▶'));
    if (next) next.click();
  });
  await page.waitForTimeout(200);
}
await page.waitForTimeout(500);
await page.screenshot({ path: '.pi/acceptance/audit-analyze-scrubbed.png', fullPage: true });

await browser.close();
console.log('Screenshots captured');
