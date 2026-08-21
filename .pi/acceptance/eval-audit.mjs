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

// Find the eval bar by looking at the DOM structure
const evalInfo = await page.evaluate(() => {
  // The EvalBar component — find by class pattern or position (left of board)
  const allDivs = document.querySelectorAll('div');
  const candidates = [];
  allDivs.forEach(d => {
    const r = d.getBoundingClientRect();
    // Eval bar is ~24px wide, tall, left of board
    if (r.width >= 15 && r.width <= 40 && r.height > 200) {
      const styles = window.getComputedStyle(d);
      candidates.push({
        class: d.className, rect: {x:r.x,y:r.y,w:r.width,h:r.height},
        bg: styles.backgroundColor, childCount: d.children.length,
        innerHTML: d.innerHTML.slice(0, 200),
      });
    }
  });
  return candidates.slice(0, 5);
});
console.log('EVAL BAR CANDIDATES:', JSON.stringify(evalInfo, null, 2));

// Also check: does the eval bar show a number?
const evalNumber = await page.evaluate(() => {
  const text = document.body.innerText;
  const m = text.match(/[-+]?\d+\.\d+/g);
  return m ? m.slice(0, 10) : 'no numbers found';
});
console.log('NUMBERS on page:', evalNumber);

await browser.close();
