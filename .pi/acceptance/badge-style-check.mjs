import { chromium } from 'playwright';
const BASE = 'http://localhost:5184/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + 'analyze', { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(2000);
await page.locator('[data-testid="pgn-input"]').fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(12000);

// Find Badge elements (class sc-AjlSJ)
const badgeInfo = await page.evaluate(() => {
  // Badge class is sc-AjlSJ
  const badges = document.querySelectorAll('.sc-AjlSJ');
  const results = [];
  badges.forEach((b, i) => {
    if (i < 3) {
      const cs = window.getComputedStyle(b);
      results.push({
        text: b.textContent,
        color: cs.color,
        className: b.className,
      });
    }
  });
  
  // Search for sc-AjlSJ in ALL style locations
  const styleMatches = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.cssText && rule.cssText.includes('AjlSJ')) {
          styleMatches.push(rule.cssText.slice(0, 300));
        }
      }
    } catch(e) {}
  }
  
  return { badges: results, styleMatches };
});
console.log('BADGE INFO:', JSON.stringify(badgeInfo, null, 2));
await browser.close();
