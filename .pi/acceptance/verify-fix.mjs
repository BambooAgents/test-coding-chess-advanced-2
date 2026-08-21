import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', err => errors.push('PAGEERR: ' + err.message));
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
if (errors.length) { console.log('ERRORS:', errors); await browser.close(); process.exit(1); }

await page.locator('textarea').first().fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(13000); // wait for analysis + auto-advance

// Check: is the brilliant badge now VISIBLE (not transparent)?
const badgeCheck = await page.evaluate(() => {
  const spans = document.querySelectorAll('span');
  const brilliant = [];
  spans.forEach(s => {
    if (s.textContent?.trim() === '!!') {
      const styles = window.getComputedStyle(s);
      brilliant.push({
        text: s.textContent, color: styles.color, bg: styles.backgroundColor,
        visible: styles.color !== 'rgba(0, 0, 0, 0)' && styles.visibility !== 'hidden' && styles.display !== 'none',
      });
    }
  });
  return { brilliantCount: brilliant.length, details: brilliant };
});
console.log('BRILLIANT BADGE:', JSON.stringify(badgeCheck, null, 2));

// Check: is there an eval bar fill now (auto-advance to ply 1)?
const evalCheck = await page.evaluate(() => {
  const fill = document.querySelector('[class*="WhiteFill"], [class*="sc-kLwfci"]');
  if (!fill) return { found: false };
  const s = window.getComputedStyle(fill);
  const r = fill.getBoundingClientRect();
  return { found: true, height: s.height, bg: s.backgroundColor, rect: { h: r.height, w: r.width } };
});
console.log('EVAL FILL:', JSON.stringify(evalCheck, null, 2));

// Check: is there a best-move arrow?
const arrowCheck = await page.evaluate(() => {
  const arrows = document.querySelectorAll('[data-testid="board-arrows"]');
  return { arrowCount: arrows.length, hasSvg: arrows.length > 0 };
});
console.log('ARROW:', JSON.stringify(arrowCheck));

// Check currentPly — should be 1 now
const plyCheck = await page.evaluate(() => {
  const text = document.body.innerText;
  const m = text.match(/(\d+)\s*\/\s*(\d+)/);
  return m ? { current: m[1], total: m[2] } : null;
});
console.log('PLY:', JSON.stringify(plyCheck));

await page.screenshot({ path: '.pi/acceptance/verify-analyze-fixed.png', fullPage: true });
await browser.close();
console.log('Done. Screenshot: .pi/acceptance/verify-analyze-fixed.png');
