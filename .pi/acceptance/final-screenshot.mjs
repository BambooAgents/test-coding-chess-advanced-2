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
// Scrub to move 10 (Nxb5) so the brilliant badge move is the current one
for (let i = 1; i < 10; i++) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => b.textContent?.trim() === '▶');
    if (next) next.click();
  });
  await page.waitForTimeout(150);
}
await page.waitForTimeout(500);
await page.screenshot({ path: '.pi/acceptance/final-analyze-nxb5.png', fullPage: true });
// Also capture the initial state (ply 1) with eval bar + arrow
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const first = btns.find(b => b.textContent?.trim() === '⏮');
  if (first) first.click();
});
await page.waitForTimeout(500);
await page.screenshot({ path: '.pi/acceptance/final-analyze-ply1.png', fullPage: true });
await browser.close();
console.log('Screenshots: final-analyze-nxb5.png, final-analyze-ply1.png');
