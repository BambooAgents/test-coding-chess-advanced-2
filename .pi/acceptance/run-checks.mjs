import { chromium } from 'playwright';

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const SHOT = (n) => `.pi/acceptance/screenshots/${n}.png`;

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.setDefaultTimeout(60000);

function log(...a) { console.log('[check]', ...a); }

async function clickByText(sel, text) {
  const els = await page.locator(sel).all();
  for (const el of els) {
    const t = (await el.innerText().catch(() => '')).trim();
    if (t.includes(text)) { await el.click(); return true; }
  }
  return false;
}

async function hasText(text) {
  const body = await page.locator('body').innerText();
  return body.includes(text);
}

// ---------- B1: Puzzles ----------
log('B1: loading /puzzles');
await page.goto(BASE + 'puzzles', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.screenshot({ path: SHOT('puzzles-home'), fullPage: true });

// Find a start button
let started = await clickByText('button, a, [role=button]', 'tart');
if (!started) {
  // try clicking the first card or a play button
  const btn = page.locator('button:has-text("tart"), a:has-text("tart"), button:has-text("olve"), button:has-text("lay")').first();
  if (await btn.count()) { await btn.click(); started = true; }
}
await page.waitForTimeout(1000);
await page.screenshot({ path: SHOT('puzzle-1'), fullPage: true });
const puzzleBody = await page.locator('body').innerText();
log('puzzle body snippet:', puzzleBody.slice(0, 300).replace(/\n/g, ' | '));

// ---------- B5: Show Solution ----------
log('B5: looking for Show Solution');
let solved = await clickByText('button, a, [role=button]', 'olution');
if (!solved) {
  // maybe need to fail it first - try wrong move? Hard. Look for hint/solution btn text in DOM
  const btns = await page.locator('button').allInnerTexts();
  log('buttons visible:', btns);
  // try any button containing "olution" or "int"
  for (const b of btns) {
    if (/olution|hint|how/i.test(b)) {
      await page.locator(`button:has-text("${b}")`).first().click();
      solved = true;
      break;
    }
  }
}
await page.waitForTimeout(1000);
await page.screenshot({ path: SHOT('puzzle-solution'), fullPage: true });
const solBody = await page.locator('body').innerText();
log('solution body snippet:', solBody.slice(0, 400).replace(/\n/g, ' | '));

// ---------- B2 & B3: Analyze Immortal Game ----------
log('B2/B3: loading /analyze');
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);
await page.screenshot({ path: SHOT('analyze-home'), fullPage: true });

const pgn = `1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4 Qc7 12.Nbd2 cxd4 13.cxd4 Nc6 14.Nb3 Nxb3 15.Qxb3 d5 16.exd5 Nxd5 17.Bg5 f6 18.Bh4 g5 19.Nxg5 fxg5 20.Bxg5 Be6 21.Rxe6 f5 22.Bxb5+ Kf8 23.Bxd5 Bg7 24.Rxd5 Be6 25.Re5 Nxd5 26.Qxd5 Qxc3 27.bxc3 Rxa2 28.Bh4 Rxc3 29.Qd7 Rc1+ 30.Bxc1 Rxc1+ 31.Ke2 Nxc3 32.Qxd8+ Nxd8 33.Bg5 Bb6 34.Kd3 Nd1 35.Re8#`;

const ta = page.locator('textarea').first();
await ta.fill(pgn);
await page.waitForTimeout(300);
await page.screenshot({ path: SHOT('analyze-pgn-pasted'), fullPage: true });

// click analyze/load button
let loadOk = await clickByText('button, a', 'nalyze');
if (!loadOk) loadOk = await clickByText('button, a', 'oad');
if (!loadOk) {
  // first button near textarea
  const btns = await page.locator('button').allInnerTexts();
  log('analyze buttons:', btns);
}
await page.waitForTimeout(1000);
await page.screenshot({ path: SHOT('analyze-start'), fullPage: true });

// Wait for analysis to progress / complete. Poll the status text.
const t0 = Date.now();
let lastStatus = '';
let completed = false;
let stuckCount = 0;
let lastCount = -1;
const progressSamples = [];
while (Date.now() - t0 < 90000) {
  const body = await page.locator('body').innerText();
  const m = body.match(/(\d+)\s*\/\s*(\d+)/);
  const status = m ? `${m[1]}/${m[2]}` : '(no progress)';
  if (status !== lastStatus) {
    log('progress:', status, 'at', ((Date.now()-t0)/1000).toFixed(0)+'s');
    lastStatus = status;
    progressSamples.push({ t: ((Date.now()-t0)/1000).toFixed(0), status });
  }
  if (m) {
    const cur = parseInt(m[1], 10);
    const tot = parseInt(m[2], 10);
    if (cur === tot) { completed = true; break; }
    if (cur === lastCount) { stuckCount++; } else { stuckCount = 0; lastCount = cur; }
  }
  await page.waitForTimeout(1500);
}
const elapsed = ((Date.now()-t0)/1000).toFixed(1);
log('analysis loop ended. completed=', completed, 'elapsed=', elapsed+'s', 'samples=', progressSamples.length);
await page.screenshot({ path: SHOT('analyze-end'), fullPage: true });
const analyzeEndBody = await page.locator('body').innerText();
log('analyze end snippet:', analyzeEndBody.slice(0, 500).replace(/\n/g, ' | '));

// Check badges present
const badgeRe = /Best|Excellent|Good|Inaccuracy|Mistake|Blunder|Brilliant|Great/g;
const badgesFound = (analyzeEndBody.match(badgeRe) || []).slice(0, 20);
log('badges found:', badgesFound);

await browser.close();

// Emit a small JSON summary
const fs = await import('fs');
fs.writeFileSync('.pi/acceptance/run-summary.json', JSON.stringify({
  puzzle1Body: puzzleBody.slice(0, 400),
  solutionBody: solBody.slice(0, 600),
  completed,
  elapsed,
  progressSamples,
  badgesFound,
}, null, 2));
log('done');
