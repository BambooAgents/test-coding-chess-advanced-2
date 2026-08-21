import { chromium } from 'playwright';
const BASE = 'http://localhost:5184/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE + 'analyze', { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(2000);

// Check if the page even loaded (production build)
const loaded = await page.evaluate(() => ({
  hasTextarea: !!document.querySelector('[data-testid="pgn-input"]'),
  bodyLen: document.body.innerText.length,
}));
console.log('Page loaded:', JSON.stringify(loaded));

if (loaded.hasTextarea) {
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
  
  const fillInfo = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="eval-bar"]');
    if (!bar) return null;
    const fill = bar.querySelector('div');
    const cs = window.getComputedStyle(fill);
    const fr = fill.getBoundingClientRect();
    
    // Check style rules
    const rules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.cssText && fill.className && rule.cssText.includes(fill.className.split(' ')[0])) {
            rules.push(rule.cssText.slice(0, 200));
          }
        }
      } catch(e) {}
    }
    
    return {
      height: cs.height,
      bg: cs.backgroundColor,
      rect: { h: fr.height },
      className: fill.className,
      styleRules: rules,
    };
  });
  console.log('PROD EVAL FILL:', JSON.stringify(fillInfo, null, 2));
}
await browser.close();
