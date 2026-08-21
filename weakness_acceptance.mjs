import { chromium } from 'playwright';

const base = 'http://localhost:5183/test-coding-chess-advanced-2/';
const shotDir = '.pi/acceptance/screenshots';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();

const logs = [];
page.on('console', (m) => logs.push(`[console:${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText}`));

async function gotoWeak() {
  await page.goto(base + 'weaknesses', { waitUntil: 'networkidle' });
}

// 1. Initial load
await gotoWeak();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shotDir}/weakness-initial.png`, fullPage: true });
console.log('=== Initial title:', await page.locator('h1').innerText());

// 2. Empty username submit
await page.getByRole('button', { name: 'Analyze' }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${shotDir}/weakness-empty-err.png`, fullPage: true });
const bodyAfterEmpty = await page.locator('body').innerText();
console.log('=== Empty error visible:', bodyAfterEmpty.includes('Please enter a chess.com username'));

// 3. Invalid username (likely 404 from chess.com pubapi)
await page.locator('input#username').fill('this_user_definitely_does_not_exist_xyzzy');
await page.locator('select#gameCount').selectOption('20');
await page.getByRole('button', { name: 'Analyze' }).click();
// Wait for either error or analyzing state
await page.waitForTimeout(10000);
await page.screenshot({ path: `${shotDir}/weakness-bad-user.png`, fullPage: true });
const bodyTxt = await page.locator('body').innerText();
console.log('=== Bad user body snippet:', JSON.stringify(bodyTxt.slice(0, 600)));
console.log('=== Bad user has error msg:', /Failed to fetch|404|Failed|No games found|error/i.test(bodyTxt));

await browser.close();
console.log('\n=== LOGS ===');
console.log(logs.join('\n'));
