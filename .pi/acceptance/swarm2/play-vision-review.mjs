/**
 * Play Page Vision Review — Hostile acceptance review with Playwright + screenshots.
 * Drives the real dev server, captures a screenshot after each meaningful state.
 * Vision-checker subagents (dispatched separately by orchestrator) read each screenshot.
 *
 * NOTE: use waitUntil 'domcontentloaded' (NOT 'networkidle' — Vite HMR keeps socket open).
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2';
const SHOT_DIR = '.pi/acceptance/swarm2/screenshots/play-vision';
const results = [];

function log(...a) { console.log('[play-vision]', ...a); }

async function shot(page, name) {
  const path = `${SHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  log(`screenshot saved: ${path}`);
  results.push({ name, path });
  return path;
}

async function waitForBoard(page) {
  await page.waitForSelector('[data-testid="chess-board"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="play-status"]', { timeout: 10000 });
}

async function clickSquare(page, sq) {
  const el = page.locator(`[data-square="${sq}"]`);
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.click();
}

async function statusText(page) {
  return (await page.textContent('[data-testid="play-status"]'))?.trim() ?? '';
}

async function moveListText(page) {
  return (await page.textContent('[data-testid="move-list"]'))?.trim() ?? '';
}

async function newGame(page, side, strength) {
  if (strength) {
    await page.selectOption('[data-testid="strength-select"]', strength);
  }
  if (side === 'white') await page.click('[data-testid="side-white"]');
  else if (side === 'black') await page.click('[data-testid="side-black"]');
  await page.click('[data-testid="new-game-btn"]');
  await page.waitForTimeout(600);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = ctx.newPage ? await ctx.newPage() : await ctx.page();

  const report = {};

  // ===== TEST 1: White vs Easy, make e4, wait for engine reply =====
  log('=== TEST 1: White vs Easy, e4 ===');
  await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
  await waitForBoard(page);
  await newGame(page, 'white', 'Easy');
  await page.waitForTimeout(500);
  const s1a = await statusText(page);
  log('initial status:', s1a);

  await clickSquare(page, 'e2');
  await page.waitForTimeout(250);
  await clickSquare(page, 'e4');
  await page.waitForTimeout(2500); // engine replies

  const s1b = await statusText(page);
  const ml1 = await moveListText(page);
  log('after e4: status=', s1b, 'moves=', ml1);
  await shot(page, '01-white-easy-e4-reply');
  report.test1 = { statusBefore: s1a, statusAfter: s1b, moves: ml1 };

  // ===== TEST 2: Switch to Expert, new game, a few moves =====
  log('=== TEST 2: Expert difficulty ===');
  await page.selectOption('[data-testid="strength-select"]', 'Expert');
  await page.click('[data-testid="new-game-btn"]');
  await page.waitForTimeout(600);
  await clickSquare(page, 'e2');
  await page.waitForTimeout(200);
  await clickSquare(page, 'e4');
  await page.waitForTimeout(12000); // expert depth may take longer
  const s2 = await statusText(page);
  const ml2 = await moveListText(page);
  log('expert after e4: status=', s2, 'moves=', ml2);
  await shot(page, '02-expert-e4-reply');
  report.test2 = { statusAfter: s2, moves: ml2 };

  // ===== TEST 3: Play as Black — engine moves first =====
  log('=== TEST 3: Play as Black ===');
  await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
  await waitForBoard(page);
  await newGame(page, 'black', 'Easy');
  await page.waitForTimeout(4000); // engine to move first
  const s3 = await statusText(page);
  const ml3 = await moveListText(page);
  log('black game: status=', s3, 'moves=', ml3);
  // Check board orientation: a8 should be bottom-left in Black's view.
  const a8 = page.locator('[data-square="a8"]');
  const h1 = page.locator('[data-square="h1"]');
  const a8Box = await a8.boundingBox();
  const h1Box = await h1.boundingBox();
  log('a8 box:', a8Box, 'h1 box:', h1Box);
  await shot(page, '03-play-black-engine-first');
  report.test3 = { status: s3, moves: ml3, a8Box, h1Box };

  // ===== TEST 4: Take-back =====
  log('=== TEST 4: Take-back ===');
  // Start fresh as white, make 2 plies (e4 then engine reply), then take back once.
  await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
  await waitForBoard(page);
  await newGame(page, 'white', 'Easy');
  await page.waitForTimeout(400);
  await clickSquare(page, 'e2');
  await page.waitForTimeout(200);
  await clickSquare(page, 'e4');
  await page.waitForTimeout(2500);
  const ml4a = await moveListText(page);
  log('before takeback moves:', ml4a);
  await page.click('[data-testid="takeback-btn"]');
  await page.waitForTimeout(800);
  const ml4b = await moveListText(page);
  const s4 = await statusText(page);
  log('after takeback moves:', ml4b, 'status:', s4);
  await shot(page, '04-takeback');
  report.test4 = { beforeTakeback: ml4a, afterTakeback: ml4b, status: s4 };

  // ===== TEST 5: Resign =====
  log('=== TEST 5: Resign ===');
  await page.click('[data-testid="resign-btn"]');
  await page.waitForTimeout(600);
  const s5 = await statusText(page);
  log('after resign status:', s5);
  await shot(page, '05-resign');
  report.test5 = { statusAfterResign: s5 };

  // ===== TEST 6: Legal move highlights =====
  log('=== TEST 6: Legal move highlights ===');
  await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
  await waitForBoard(page);
  await newGame(page, 'white', 'Easy');
  await page.waitForTimeout(400);
  // Click knight b1 -> legal destinations a3, c3
  await clickSquare(page, 'b1');
  await page.waitForTimeout(400);
  // Probe pseudo-elements on candidate squares
  const probes = await page.evaluate(() => {
    const out = {};
    for (const sq of ['a3', 'c3', 'd2', 'e4', 'b1']) {
      const el = document.querySelector(`[data-square="${sq}"]`);
      if (!el) { out[sq] = null; continue; }
      const after = window.getComputedStyle(el, '::after');
      const box = el.getBoundingClientRect();
      out[sq] = {
        afterOpacity: after.opacity,
        afterContent: after.content,
        afterBg: after.backgroundColor,
        afterWidth: after.width,
        afterHeight: after.height,
        rect: { x: box.x, y: box.y, w: box.width, h: box.height },
      };
    }
    return out;
  });
  log('legal-move probes:', JSON.stringify(probes, null, 2));
  await shot(page, '06-legal-highlights');
  report.test6 = { probes };

  // ===== TEST 7: Illegal move =====
  log('=== TEST 7: Illegal move attempt ===');
  // Try e2 -> d3 (illegal pawn move)
  await clickSquare(page, 'e2');
  await page.waitForTimeout(200);
  await clickSquare(page, 'd3');
  await page.waitForTimeout(1200);
  // Look for toast text
  const toastText = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div, span, p'));
    return all
      .map((e) => (e.textContent || '').trim())
      .filter((t) => /illegal|invalid|cannot|not legal|not allowed/i.test(t))
      .slice(0, 10);
  });
  log('illegal toast candidates:', toastText);
  await shot(page, '07-illegal-move');
  report.test7 = { toastCandidates: toastText };

  // ===== TEST 8: Analyze handoff =====
  log('=== TEST 8: Analyze handoff ===');
  await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
  await waitForBoard(page);
  await newGame(page, 'white', 'Easy');
  await page.waitForTimeout(400);
  await clickSquare(page, 'e2');
  await page.waitForTimeout(200);
  await clickSquare(page, 'e4');
  await page.waitForTimeout(2500);
  const ml8 = await moveListText(page);
  log('played moves before handoff:', ml8);
  await page.click('[data-testid="analyze-btn"]');
  await page.waitForTimeout(2000);
  const url = page.url();
  log('handoff url:', url);

  // Inspect analyze page state
  const analyzeState = await page.evaluate(() => {
    const ta = document.querySelector('[data-testid="pgn-input"]');
    return {
      pgnInputValue: ta ? ta.value : null,
      pgnInputLen: ta ? ta.value.length : 0,
      hasMoveList: !!document.querySelector('[data-testid="move-list"], [data-testid="analysis-moves"]'),
      bodyTextSample: document.body.innerText.slice(0, 300),
    };
  });
  log('analyze state:', JSON.stringify(analyzeState, null, 2));
  await shot(page, '08-analyze-handoff');
  report.test8 = { playedMoves: ml8, url, analyzeState };

  await browser.close();

  // Write a JSON summary the orchestrator can read alongside screenshots.
  const fs = await import('fs');
  fs.writeFileSync(`${SHOT_DIR}/report.json`, JSON.stringify(report, null, 2));
  log('DONE. screenshots:', results.map((r) => r.path).join('\n  '));
}

main().catch((e) => {
  console.error('[play-vision] FATAL', e);
  process.exit(1);
});
