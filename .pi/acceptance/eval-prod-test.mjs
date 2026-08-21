import { chromium } from 'playwright';
const BASE = 'http://localhost:5184/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.locator('textarea').first().fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(13000);
const h = await page.evaluate(() => {
  // In prod the class names differ. Find the fill by its styles
  const fills = [];
  document.querySelectorAll('div').forEach(d => {
    const s = window.getComputedStyle(d);
    if (s.position === 'absolute' && s.bottom === '0px' && s.backgroundColor === 'rgb(248, 248, 248)') {
      fills.push({ height: s.height, class: d.className.slice(0,30) });
    }
  });
  return fills;
});
console.log('PROD EVAL FILL:', JSON.stringify(h, null, 2));
await browser.close();
