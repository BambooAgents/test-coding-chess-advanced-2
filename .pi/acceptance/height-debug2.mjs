import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
console.log('starting');
const browser = await chromium.launch({ headless: true });
console.log('browser launched');
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
console.log('page created');
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded', timeout: 10000 });
console.log('page loaded');
await page.waitForTimeout(1000);
console.log('filling pgn');
await page.locator('[data-testid="pgn-input"]').fill(OPERA);
console.log('clicking load');
await page.locator('button:has-text("Load PGN")').click();
console.log('waiting for analysis');
await page.waitForTimeout(12000);
console.log('scrubbing');
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => b.textContent?.includes('▶'));
    if (next) next.click();
  });
  await page.waitForTimeout(200);
}
await page.waitForTimeout(500);
console.log('checking height');

const testResult = await page.evaluate(() => {
  const bar = document.querySelector('[data-testid="eval-bar"]');
  const fill = bar?.querySelector('div');
  if (!fill) return 'no fill found';
  
  fill.style.height = '60%';
  const h1 = window.getComputedStyle(fill).height;
  fill.style.height = '336px';
  const h2 = window.getComputedStyle(fill).height;
  fill.style.height = '';
  
  return {
    withPercent: h1,
    withPixels: h2,
    barHeight: window.getComputedStyle(bar).height,
    inlineStyle: fill.getAttribute('style'),
    styleLength: fill.style.length,
  };
});
console.log('RESULT:', JSON.stringify(testResult, null, 2));
await browser.close();
console.log('done');
