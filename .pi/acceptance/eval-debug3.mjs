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
// Get the actual HTML and all styles of the fill element
const fillData = await page.evaluate(() => {
  const bar = document.querySelector('[data-testid="eval-bar"]');
  if (!bar) return { error: 'no eval-bar' };
  const fill = bar.children[0]; // first child = WhiteFill
  return {
    barHTML: bar.innerHTML.slice(0, 300),
    fillTag: fill?.tagName,
    fillClass: fill?.className,
    fillStyle: fill?.getAttribute('style'),
    fillComputedHeight: fill ? window.getComputedStyle(fill).height : null,
    fillComputedBottom: fill ? window.getComputedStyle(fill).bottom : null,
    // Check ALL stylesheet rules for this class
    allRules: (() => {
      const rules = [];
      for (const sheet of document.styleSheets) {
        try { for (const r of sheet.cssRules) { if (r.cssText?.includes(fill?.className)) rules.push(r.cssText); } } catch(e) {}
      }
      return rules;
    })(),
  };
});
console.log(JSON.stringify(fillData, null, 2));
await browser.close();
