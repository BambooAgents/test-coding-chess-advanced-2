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

const evalData = await page.evaluate(() => {
  const evalBar = document.querySelector('[data-testid="eval-bar"]');
  if (!evalBar) return { found: false };
  const fill = evalBar.querySelector('div');
  const labels = [...evalBar.querySelectorAll('span, div')].filter(l => l.textContent?.trim());
  const s = window.getComputedStyle(fill);
  const r = fill.getBoundingClientRect();
  return {
    found: true,
    fill: { height: s.height, bg: s.backgroundColor, rect: { h: r.height, y: r.y } },
    labels: labels.map(l => ({ text: l.textContent.trim(), color: window.getComputedStyle(l).color })),
    evalBarHTML: evalBar.innerHTML.slice(0, 300),
  };
});
console.log('EVAL BAR at ply 5:', JSON.stringify(evalData, null, 2));

// Check the EvalBar component logic
const evalScoreProp = await page.evaluate(() => {
  // Check if the eval bar label shows a value
  const evalLabel = document.querySelector('[data-testid="eval-bar"] div[style*="top"], [data-testid="eval-bar"] div[style*="bottom"]');
  if (!evalLabel) return { label: null };
  return {
    text: evalLabel.textContent,
    style: evalLabel.getAttribute('style'),
    visible: window.getComputedStyle(evalLabel).color !== 'rgba(0, 0, 0, 0)',
  };
});
console.log('EVAL LABEL:', JSON.stringify(evalScoreProp, null, 2));

await browser.close();
