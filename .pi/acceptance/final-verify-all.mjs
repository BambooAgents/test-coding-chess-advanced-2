import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', err => errors.push(err.message));
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.locator('textarea').first().fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(13000);

const results = await page.evaluate(() => {
  // V1: Brilliant badge visible
  const brilliantEl = [...document.querySelectorAll('span')].find(s => s.textContent?.trim() === '!!');
  const brilliant = brilliantEl ? {
    color: window.getComputedStyle(brilliantEl).color,
    visible: window.getComputedStyle(brilliantEl).color !== 'rgba(0, 0, 0, 0)',
  } : { found: false };

  // V2: Auto-advance (currentPly should be 1, not 0)
  const text = document.body.innerText;
  const plyMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
  const autoAdvance = plyMatch ? { current: parseInt(plyMatch[1]), advanced: parseInt(plyMatch[1]) > 0 } : null;

  // V2: Best-move arrow present
  const arrow = { count: document.querySelectorAll('[data-testid="board-arrows"]').length };

  // V3: Eval bar fill height > 0
  const fill = document.querySelector('[class*="sc-kLwfci"]');
  const evalBar = fill ? {
    height: window.getComputedStyle(fill).height,
    hasFill: parseFloat(window.getComputedStyle(fill).height) > 0,
  } : { found: false };

  // Eval label
  const label = document.querySelector('[class*="sc-ikJwur"]')?.textContent;

  return { brilliant, autoAdvance, arrow, evalBar, label };
});

console.log('=== FINAL VERIFICATION OF ALL 3 FIXES ===');
console.log('V1 (Brilliant badge visible):', JSON.stringify(results.brilliant));
console.log('V2 (Auto-advance to ply 1):  ', JSON.stringify(results.autoAdvance));
console.log('V2 (Best-move arrow):         ', JSON.stringify(results.arrow));
console.log('V3 (Eval bar fill > 0):       ', JSON.stringify(results.evalBar));
console.log('Eval label:                   ', JSON.stringify(results.label));
console.log('Page errors:                  ', JSON.stringify(errors));

await page.screenshot({ path: '.pi/acceptance/FINAL-verify-all-fixes.png', fullPage: true });
await browser.close();
