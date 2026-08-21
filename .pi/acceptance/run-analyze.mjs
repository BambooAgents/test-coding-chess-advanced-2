import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/analyze';
const SHOT = (n) => `.pi/acceptance/screenshots/${n}.png`;
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);
const log = (...a) => console.log('[analyze]', ...a);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.screenshot({ path: SHOT('analyze-home'), fullPage: true });

const pgn = `1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4 Qc7 12.Nbd2 cxd4 13.cxd4 Nc6 14.Nb3 Nxb3 15.Qxb3 d5 16.exd5 Nxd5 17.Bg5 f6 18.Bh4 g5 19.Nxg5 fxg5 20.Bxg5 Be6 21.Rxe6 f5 22.Bxb5+ Kf8 23.Bxd5 Bg7 24.Rxd5 Be6 25.Re5 Nxd5 26.Qxd5 Qxc3 27.bxc3 Rxa2 28.Bh4 Rxc3 29.Qd7 Rc1+ 30.Bxc1 Rxc1+ 31.Ke2 Nxc3 32.Qxd8+ Nxd8 33.Bg5 Bb6 34.Kd3 Nd1 35.Re8#`;
await page.locator('textarea').first().fill(pgn);
await page.waitForTimeout(300);
await page.screenshot({ path: SHOT('analyze-pgn-pasted'), fullPage: true });
await page.getByText('Load PGN', { exact: true }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOT('analyze-start'), fullPage: true });

const t0 = Date.now();
let lastStatus = '';
let completed = false;
let lastCount = -1;
let stuckCount = 0;
const samples = [];
while (Date.now() - t0 < 120000) {
  let status = '(no progress)';
  const analyzing = await page.locator('[data-testid="analyzing"]').count();
  if (analyzing > 0) {
    status = await page.locator('[data-testid="analyzing"]').innerText();
  } else {
    // maybe done
    const ml = await page.locator('[data-testid="move-list"]').count();
    if (ml > 0) {
      const acc = await page.locator('[data-testid="accuracy"]').innerText().catch(() => '');
      status = 'DONE? acc=' + acc.slice(0, 80);
    }
  }
  if (status !== lastStatus) {
    log('progress:', JSON.stringify(status), 'at', ((Date.now()-t0)/1000).toFixed(0)+'s');
    lastStatus = status;
    samples.push({ t: ((Date.now()-t0)/1000).toFixed(0), status });
  }
  const m = status.match(/(\d+)\s*\/\s*(\d+)/);
  if (m) {
    const cur = parseInt(m[1], 10), tot = parseInt(m[2], 10);
    if (cur === tot && analyzing === 0) { completed = true; break; }
    if (cur === lastCount) { stuckCount++; } else { stuckCount = 0; lastCount = cur; }
  } else if (status.startsWith('DONE')) { completed = true; break; }
  await page.waitForTimeout(2000);
}
const elapsed = ((Date.now()-t0)/1000).toFixed(1);
log('end completed=', completed, 'elapsed=', elapsed+'s', 'stuckCount=', stuckCount);
await page.screenshot({ path: SHOT('analyze-end'), fullPage: true });
const body = await page.locator('body').innerText();
log('end snippet:', body.slice(0, 600).replace(/\n/g, ' | '));
const badges = (body.match(/Best|Excellent|Good|Inaccuracy|Mistake|Blunder|Brilliant|Great/g) || []).slice(0,30);
log('badges:', badges);
await browser.close();
import fs from 'fs';
fs.writeFileSync('.pi/acceptance/analyze-summary.json', JSON.stringify({ completed, elapsed, samples, badges }, null, 2));
