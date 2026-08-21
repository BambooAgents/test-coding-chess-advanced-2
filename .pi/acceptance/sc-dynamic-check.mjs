import { chromium } from 'playwright';
const BASE = 'http://localhost:5184/test-coding-chess-advanced-2/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(2000);

// Go to play page and click a square to see if $isSelected dynamic style works
await page.goto(BASE + 'play', { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(1000);

// Click e2 (a white pawn)
await page.evaluate(() => {
  const squares = document.querySelectorAll('[data-square]');
  // Find e2
  for (const sq of squares) {
    if (sq.dataset.square === 'e2') { sq.click(); break; }
  }
});
await page.waitForTimeout(500);

// Check if the selected square has a different background (dynamic $isSelected style)
const squareInfo = await page.evaluate(() => {
  const squares = document.querySelectorAll('[data-square]');
  const results = [];
  for (const sq of squares) {
    if (['e2', 'e4', 'd2'].includes(sq.dataset.square)) {
      const cs = window.getComputedStyle(sq);
      results.push({
        square: sq.dataset.square,
        bg: cs.backgroundColor,
        className: sq.className.slice(0, 40),
      });
    }
  }
  
  // Check style rules for the BoardSquare class
  const firstClass = squares[0]?.className.split(' ')[0];
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.cssText && firstClass && rule.cssText.includes(firstClass)) {
          rules.push(rule.cssText.slice(0, 300));
        }
      }
    } catch(e) {}
  }
  
  return { squares: results, styleRulesCount: rules.length, sampleRules: rules.slice(0, 3) };
});
console.log(JSON.stringify(squareInfo, null, 2));
await browser.close();
