import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2';

async function screenshot(name) {
  await page.screenshot({ path: `.pi/acceptance/screenshots/${name}.png`, fullPage: true });
  console.log(`Screenshot: ${name}`);
  return `.pi/acceptance/screenshots/${name}.png`;
}

async function clickPiece(square) {
  // Click on a specific square (e.g., 'e2')
  const sqEl = await page.$(`[data-square="${square}"]`);
  if (sqEl) {
    await sqEl.click();
    await page.waitForTimeout(300);
  }
}

console.log('=== PLAY PAGE HOSTILE ACCEPTANCE TEST ===\n');

// Test 1: Navigate to Play page and check initial state
console.log('Test 1: Initial Play page');
await page.goto(`${BASE}/#/play`);
await page.waitForTimeout(2000);
await screenshot('play-01-initial');

// Test 2: Start a game as White vs Easy
console.log('Test 2: Start game as White vs Easy');
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(2000);
await screenshot('play-02-new-game-easy');

// Test 3: Make move e4 (click e2, then e4)
console.log('Test 3: Make move e4');
await clickPiece('e2');
await page.waitForTimeout(500);
await screenshot('play-03-legal-highlights');
await clickPiece('e4');
await page.waitForTimeout(2000);
await screenshot('play-04-after-e4');

// Test 4: Wait for engine response
console.log('Test 4: Engine response');
await page.waitForTimeout(3000);
await screenshot('play-05-engine-response');

// Test 5: Check move list
const moveListText = await page.$eval('[data-testid="move-list"]', el => el.textContent);
console.log('Move list:', moveListText);

// Test 6: Switch to Expert and start new game
console.log('Test 5: Switch to Expert difficulty');
await page.selectOption('[data-testid="strength-select"]', 'Expert');
await page.waitForTimeout(500);
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(1500);
await screenshot('play-06-expert-game');

// Test 7: Make a few moves at Expert level
console.log('Test 6: Expert level moves');
await clickPiece('e2');
await page.waitForTimeout(300);
await clickPiece('e4');
await page.waitForTimeout(3000);
await screenshot('play-07-expert-response');

// Test 8: Play as Black
console.log('Test 7: Play as Black');
await page.click('[data-testid="side-black"]');
await page.waitForTimeout(1000);
await screenshot('play-08-black-perspective');

// Test 9: Engine moves first as Black
console.log('Test 8: Engine moves first (Black perspective)');
await page.waitForTimeout(3000);
await screenshot('play-09-engine-first-black');

// Test 10: Take-back test
console.log('Test 9: Take-back functionality');
await page.click('[data-testid="side-white"]');
await page.waitForTimeout(500);
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(1000);
await clickPiece('e2');
await clickPiece('e4');
await page.waitForTimeout(2000);
await clickPiece('e7');
await clickPiece('e5');
await page.waitForTimeout(1000);
await screenshot('play-10-before-takeback');
await page.click('[data-testid="takeback-btn"]');
await page.waitForTimeout(1000);
await screenshot('play-11-after-takeback');

// Test 11: Resign test
console.log('Test 10: Resign');
await page.click('[data-testid="resign-btn"]');
await page.waitForTimeout(1000);
await screenshot('play-12-resign');

// Test 12: New game after resign
console.log('Test 11: New game after resign');
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(1500);
await screenshot('play-13-new-after-resign');

// Test 13: Try illegal move
console.log('Test 12: Illegal move attempt');
await clickPiece('e2');
await page.waitForTimeout(300);
await clickPiece('e6'); // illegal pawn move
await page.waitForTimeout(500);
await screenshot('play-14-illegal-move');

// Test 14: Check for toast message
const toastVisible = await page.$eval('[data-testid="play-status"]', el => el.textContent).catch(() => '');
console.log('Status text:', toastVisible);

// Test 15: Analyze handoff
console.log('Test 13: Analyze handoff');
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(1000);
await clickPiece('e2');
await clickPiece('e4');
await page.waitForTimeout(2000);
await page.click('[data-testid="analyze-btn"]');
await page.waitForTimeout(2000);
const currentUrl = page.url();
console.log('URL after analyze click:', currentUrl);
await screenshot('play-15-analyze-handoff');

// Test 16: Visual quality check - pieces rendering
console.log('Test 14: Visual quality');
await page.goto(`${BASE}/#/play`);
await page.waitForTimeout(2000);
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(1000);
await screenshot('play-16-visual-quality');

await browser.close();
console.log('\n=== ALL TESTS COMPLETED ===');
