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
// Check the React state via the rendered eval label
const evalLabel = await page.evaluate(() => {
  const text = document.body.innerText;
  // Find eval-like numbers
  const evalMatches = text.match(/[-+]?\d+\.\d+|M\d+/g);
  return { evalMatches, textSnippet: text.slice(0, 400) };
});
console.log('EVAL LABEL:', JSON.stringify(evalLabel, null, 2));

// Check the fill element's actual pct prop
const fillInfo = await page.evaluate(() => {
  const fill = document.querySelector('[class*="sc-kLwfci"]');
  if (!fill) return null;
  return {
    height: window.getComputedStyle(fill).height,
    bottom: window.getComputedStyle(fill).bottom,
    parentHeight: window.getComputedStyle(fill.parentElement).height,
  };
});
console.log('FILL:', JSON.stringify(fillInfo, null, 2));
await browser.close();
