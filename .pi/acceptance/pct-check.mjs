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

// Get ALL CSS properties of the fill element
const allCss = await page.evaluate(() => {
  const bar = document.querySelector('[data-testid="eval-bar"]');
  const fill = bar?.querySelector('div');
  if (!fill) return null;
  const cs = window.getComputedStyle(fill);
  // Get every property
  const props = {};
  for (let i = 0; i < cs.length; i++) {
    const prop = cs[i];
    props[prop] = cs.getPropertyValue(prop);
  }
  return props;
});
// Print just the relevant ones
const relevant = ['height', 'position', 'bottom', 'top', 'left', 'right', 'background-color', 'display', 'visibility', 'opacity', 'min-height', 'max-height', 'transform'];
for (const prop of relevant) {
  console.log(`${prop}: ${allCss?.[prop] || 'N/A'}`);
}

// Check: does the bar itself have height?
const barCss = await page.evaluate(() => {
  const bar = document.querySelector('[data-testid="eval-bar"]');
  const cs = window.getComputedStyle(bar);
  return { height: cs.height, position: cs.position, display: cs.display };
});
console.log('\nBAR:', JSON.stringify(barCss));

// Check: is the fill a direct child of Bar?
const domTree = await page.evaluate(() => {
  const bar = document.querySelector('[data-testid="eval-bar"]');
  return {
    childCount: bar?.children.length,
    children: [...bar?.children].map(c => ({ tag: c.tagName, class: c.className.slice(0,30), height: window.getComputedStyle(c).height })),
  };
});
console.log('BAR CHILDREN:', JSON.stringify(domTree, null, 2));

await browser.close();
