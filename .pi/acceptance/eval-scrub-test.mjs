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

// Scrub to ply 5 and check the fill
for (const targetPly of [3, 5, 10, 15]) {
  // Click next button (targetPly - currentPly) times. Current is 1.
  for (let i = 1; i < targetPly; i++) {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const next = btns.find(b => b.textContent?.trim() === '▶');
      if (next) next.click();
    });
    await page.waitForTimeout(200);
  }
  const h = await page.evaluate(() => {
    const fill = document.querySelector('[class*="sc-kLwfci"]');
    return { height: window.getComputedStyle(fill).height, label: document.querySelector('[class*="sc-ikJwur"]')?.textContent };
  });
  console.log(`ply ${targetPly}:`, JSON.stringify(h));
}
await browser.close();
