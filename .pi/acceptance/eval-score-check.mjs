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

// Scrub to ply 5
for (let i = 0; i < 5; i++) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => b.textContent?.includes('▶'));
    if (next) next.click();
  });
  await page.waitForTimeout(200);
}
await page.waitForTimeout(500);

// Check the React state — what eval is being passed to EvalBar?
const reactInfo = await page.evaluate(() => {
  // The eval label text shows what eval is being used
  const evalBar = document.querySelector('[data-testid="eval-bar"]');
  const labels = [...evalBar.querySelectorAll('div')].filter(d => d.textContent?.trim() && d.children.length === 0);
  
  // Check: what's the WhiteFill class and its stylesheet rules?
  const fill = evalBar.querySelector('div');
  const fillClass = fill?.className;
  // Find the style rule
  let styleRule = null;
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.selectorText && rule.selectorText.includes(fillClass?.split(' ')[0])) {
          styleRule = { selector: rule.selectorText, cssText: rule.cssText.slice(0, 200) };
        }
      }
    } catch(e) {}
  }
  
  return {
    labels: labels.map(l => ({ text: l.textContent, style: l.getAttribute('style') })),
    fillClass,
    styleRule,
  };
});
console.log(JSON.stringify(reactInfo, null, 2));
await browser.close();
