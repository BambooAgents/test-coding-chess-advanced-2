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
// Check: the label shows -0.71, meaning the EvalBar IS receiving a score.
// But fill is 0px. Let me check the WhiteFill styled-component's $pct prop.
// The issue might be that styled-components generates a class with the pct baked in.
// Let me look at the actual CSS rule applied
const fillCss = await page.evaluate(() => {
  const fill = document.querySelector('[class*="sc-kLwfci"]');
  if (!fill) return null;
  // Get the computed height AND the inline style
  const cs = window.getComputedStyle(fill);
  // Check all style sheets for the sc-kLwfci class rule
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.cssText && rule.cssText.includes('sc-kLwfci') && rule.cssText.includes('height')) {
          rules.push(rule.cssText.slice(0, 200));
        }
      }
    } catch(e) {}
  }
  return { computedHeight: cs.height, rules };
});
console.log('FILL CSS:', JSON.stringify(fillCss, null, 2));
await browser.close();
