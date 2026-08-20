import { chromium } from 'playwright';

const base = 'http://localhost:5183/test-coding-chess-advanced-2/';
const shotDir = '.pi/acceptance/screenshots';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[console:${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));
page.on('request', (r) => {
  if (r.url().includes('chess.com') || r.url().includes('pub/player')) {
    logs.push(`[req] ${r.method()} ${r.url()}`);
  }
});
page.on('response', (r) => {
  if (r.url().includes('chess.com')) {
    logs.push(`[resp] ${r.status()} ${r.url()}`);
  }
});

await page.goto(base + 'weaknesses', { waitUntil: 'networkidle' });

// Capture the progress text as it evolves, to verify LIVE updates
const progressSamples = [];
const recCountSamples = [];

await page.locator('input#username').fill('hikaru');
await page.locator('select#gameCount').selectOption('20');
await page.getByRole('button', { name: 'Analyze' }).click();

// Poll for up to ~8 minutes
const start = Date.now();
let lastProgress = '';
let done = false;
while (Date.now() - start < 480000) {
  await page.waitForTimeout(3000);
  const progressText = await page.locator('body').innerText().catch(() => '');
  // Extract the "Analyzing game X of Y" line
  const m = progressText.match(/Analyzing game (\d+) of (\d+)/);
  const pm = progressText.match(/Analysis complete: (\d+)/);
  if (m) {
    const cur = `game ${m[1]}/${m[2]}`;
    if (cur !== lastProgress) {
      progressSamples.push(`${((Date.now()-start)/1000).toFixed(0)}s: ${cur}`);
      lastProgress = cur;
    }
  }
  if (pm) {
    progressSamples.push(`${((Date.now()-start)/1000).toFixed(0)}s: COMPLETE ${pm[1]}`);
    done = true;
    break;
  }
  // Also sample recommendation count live
  const recs = await page.locator('h3').count().catch(() => 0);
  recCountSamples.push(`${((Date.now()-start)/1000).toFixed(0)}s: recs=${recs}`);
  if (Date.now() - start > 120000 && progressSamples.length === 0) {
    // Take an in-progress screenshot anyway
    await page.screenshot({ path: `${shotDir}/weakness-hikaru-stuck.png`, fullPage: true });
    progressSamples.push('STUCK: no progress text after 120s');
  }
}

await page.screenshot({ path: `${shotDir}/weakness-hikaru-final.png`, fullPage: true });
const finalBody = await page.locator('body').innerText();
console.log('=== Progress samples (live update evidence):');
console.log(progressSamples.join('\n'));
console.log('\n=== Rec count samples:');
console.log(recCountSamples.filter((_, i) => i % 3 === 0).join('\n'));
console.log('\n=== Done:', done);
console.log('\n=== Final body (first 2000 chars):');
console.log(finalBody.slice(0, 2000));

await browser.close();
console.log('\n=== Selected LOGS (chess.com reqs + errors) ===');
console.log(logs.filter(l => l.includes('chess.com') || l.includes('pageerror') || l.includes('Stockfish')).join('\n'));
