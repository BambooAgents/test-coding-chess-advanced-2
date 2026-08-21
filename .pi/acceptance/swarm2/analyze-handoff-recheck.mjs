/**
 * Re-verify the Analyze handoff: distinguish PGN textarea from move list.
 * Probe the actual <textarea data-testid="pgn-input"> value AND its rendered
 * visible text, plus the move-list panel, to settle the vision-vs-DOM discrepancy.
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/play`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-testid="chess-board"]', { timeout: 15000 });
  await page.waitForSelector('[data-testid="play-status"]', { timeout: 10000 });
  // easy, white
  await page.selectOption('[data-testid="strength-select"]', 'Easy');
  await page.click('[data-testid="side-white"]');
  await page.click('[data-testid="new-game-btn"]');
  await page.waitForTimeout(500);
  // e4
  await page.locator('[data-square="e2"]').click();
  await page.waitForTimeout(200);
  await page.locator('[data-square="e4"]').click();
  await page.waitForTimeout(2500);
  console.log('play moves:', (await page.textContent('[data-testid="move-list"]'))?.trim());

  // handoff
  await page.click('[data-testid="analyze-btn"]');
  // wait for analyze page textarea
  await page.waitForSelector('[data-testid="pgn-input"]', { timeout: 10000 });
  // Give analysis a moment to populate
  await page.waitForTimeout(3000);
  console.log('analyze url:', page.url());

  const probe = await page.evaluate(() => {
    const ta = document.querySelector('[data-testid="pgn-input"]');
    const taRect = ta ? ta.getBoundingClientRect() : null;
    // Also list every textarea on the page
    const allTAs = Array.from(document.querySelectorAll('textarea')).map((t) => ({
      testid: t.getAttribute('data-testid'),
      value: t.value,
      valueLen: t.value.length,
      placeholder: t.placeholder,
      visible: t.getBoundingClientRect().height > 0,
    }));
    // move-list element text
    const ml = document.querySelector('[data-testid="move-list"]') || document.querySelector('[data-testid="analysis-moves"]');
    return {
      pgnInput: ta ? { value: ta.value, valueLen: ta.value.length, placeholder: ta.placeholder, rect: taRect } : null,
      allTextareas: allTAs,
      moveListText: ml ? (ml.textContent || '').trim() : null,
      moveListTestId: ml ? ml.getAttribute('data-testid') : null,
      // any element visibly containing "1. e4"
      e4e5Holders: Array.from(document.querySelectorAll('*'))
        .filter((e) => /1\.\s*e4\s*e?5?/.test(e.textContent || '') && e.children.length < 3)
        .slice(0, 5)
        .map((e) => ({ tag: e.tagName, testid: e.getAttribute('data-testid'), text: (e.textContent || '').trim().slice(0, 60), rect: e.getBoundingClientRect() })),
    };
  });
  console.log('PROBE:', JSON.stringify(probe, null, 2));
  await page.screenshot({ path: '.pi/acceptance/swarm2/screenshots/play-vision/08b-analyze-handoff-recheck.png', fullPage: true });

  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
