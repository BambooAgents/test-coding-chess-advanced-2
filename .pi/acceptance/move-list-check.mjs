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

const layout = await page.evaluate(() => {
  const viewport = { w: window.innerWidth, h: window.innerHeight };
  const body = { w: document.body.scrollWidth, h: document.body.scrollHeight };
  
  // Find the move list container
  const allEls = document.querySelectorAll('*');
  let moveListEl = null;
  for (const el of allEls) {
    if (el.textContent?.includes('Nxb5') && el.textContent?.includes('Rd8#')) {
      const r = el.getBoundingClientRect();
      if (r.width > 100) { moveListEl = el; break; }
    }
  }
  
  let moveListRect = null;
  if (moveListEl) {
    const r = moveListEl.getBoundingClientRect();
    moveListRect = { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom };
  }
  
  // Check all badge positions — are they below the fold?
  const badges = document.querySelectorAll('.sc-AjlSJ');
  const badgePositions = [];
  badges.forEach((b, i) => {
    const r = b.getBoundingClientRect();
    badgePositions.push({
      text: b.textContent,
      y: r.y,
      bottom: r.bottom,
      belowFold: r.bottom > viewport.h,
    });
  });
  
  return { viewport, body, moveListRect, badgePositions: badgePositions.slice(0, 5), badgesBelowFold: badgePositions.filter(b => b.belowFold).length, totalBadges: badges.length };
});
console.log(JSON.stringify(layout, null, 2));
await browser.close();
