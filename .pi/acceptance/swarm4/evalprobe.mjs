import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const PGN = `1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7 8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ *`;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.click('a[href*="/analyze"]');
await page.waitForTimeout(1500);
await page.fill('[data-testid="pgn-input"]', PGN);
await page.click('button:has-text("Load PGN")');
// wait for analysis
for (let i=0;i<80;i++){
  const st = await page.evaluate(()=>{const a=document.querySelector('[data-testid="analyzing"]');const c=document.querySelector('[data-testid="cancel-analysis"]');return {a: a?!!a.offsetParent:false,c:c?!!c.offsetParent:false};});
  if(!st.a && !st.c && i>4) break;
  await page.waitForTimeout(500);
}
// scrub to ply 1
await page.click('[data-testid="move-list"] [data-ply="1"]');
await page.waitForTimeout(800);
// probe eval bar fill / aria / text and the eval score
const probe = await page.evaluate(() => {
  const eb = document.querySelector('[data-testid="eval-bar"]');
  // look for any fill element inside
  const fills = eb ? Array.from(eb.querySelectorAll('*')).map(e=>({tag:e.tagName, cls:e.className, style:e.getAttribute('style'), text:e.innerText, h:e.getBoundingClientRect().height, y:e.getBoundingClientRect().y})) : [];
  // aria / title attributes
  const aria = eb ? { ariaLabel: eb.getAttribute('aria-label'), title: eb.getAttribute('title'), ariaValueNow: eb.getAttribute('aria-valuenow'), ariaValueText: eb.getAttribute('aria-valuetext') } : null;
  // any text node with eval
  const allText = document.body.innerText.match(/-?\d+\.\d+/g);
  // scrubber text
  const sc = document.querySelector('[data-testid="scrubber"]')?.innerText;
  return { ebRect: eb?(()=>{const r=eb.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})():null, fills: fills.slice(0,8), aria, evalishTexts: allText, scrubber: sc };
});
console.log(JSON.stringify(probe,null,2));
await browser.close();
