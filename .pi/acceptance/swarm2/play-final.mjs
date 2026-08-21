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
  const sqEl = await page.$(`[data-square="${square}"]`);
  if (sqEl) {
    await sqEl.click();
    await page.waitForTimeout(300);
    return true;
  }
  return false;
}

console.log('=== PLAY PAGE HOSTILE ACCEPTANCE TEST ===\n');

// Test 1: Navigate to Play page (no hash - HTML5 routing)
console.log('Test 1: Navigate to Play page');
await page.goto(`${BASE}/play`);
await page.waitForTimeout(3000);
await screenshot('play-01-initial');

// Test 2: Start a game as White vs Easy
console.log('Test 2: Start game as White vs Easy');
const newGameBtn = await page.$('[data-testid="new-game-btn"]');
console.log('New Game button found:', !!newGameBtn);
if (newGameBtn) {
  await newGameBtn.click();
  await page.waitForTimeout(2000);
  await screenshot('play-02-new-game-easy');
} else {
  await screenshot('play-02-no-button');
}

// Test 3: Check if board is visible
console.log('Test 3: Board visibility');
const board = await page.$('[data-testid="chess-board"]');
console.log('Board found:', !!board);
await screenshot('play-03-board-visible');

// Test 4: Make move e4 (click e2, then e4)
console.log('Test 4: Make move e4');
const e2Clicked = await clickPiece('e2');
console.log('e2 clicked:', e2Clicked);
await page.waitForTimeout(500);
await screenshot('play-04-legal-highlights');
if (e2Clicked) {
  await clickPiece('e4');
  await page.waitForTimeout(2000);
  await screenshot('play-05-after-e4');
}

// Test 5: Wait for engine response
console.log('Test 5: Engine response');
await page.waitForTimeout(4000);
await screenshot('play-06-engine-response');

// Test 6: Check move list
const moveListEl = await page.$('[data-testid="move-list"]');
const moveListText = moveListEl ? await moveListEl.textContent() : 'NOT FOUND';
console.log('Move list:', moveListText);

// Test 7: Switch to Expert and start new game
console.log('Test 6: Switch to Expert difficulty');
const strengthSelect = await page.$('[data-testid="strength-select"]');
console.log('Strength select found:', !!strengthSelect);
if (strengthSelect) {
  await strengthSelect.selectOption('Expert');
  await page.waitForTimeout(500);
  await page.click('[data-testid="new-game-btn"]');
  await page.waitForTimeout(2000);
  await screenshot('play-07-expert-game');
}

// Test 8: Make a few moves at Expert level
console.log('Test 7: Expert level moves');
await clickPiece('e2');
await page.waitForTimeout(300);
await clickPiece('e4');
await page.waitForTimeout(4000);
await screenshot('play-08-expert-response');

// Test 9: Play as Black - check board flip
console.log('Test 8: Play as Black');
const blackBtn = await page.$('[data-testid="side-black"]');
console.log('Black button found:', !!blackBtn);
if (blackBtn) {
  await blackBtn.click();
  await page.waitForTimeout(1500);
  await screenshot('play-09-black-perspective');
}

// Test 10: Engine moves first as Black
console.log('Test 9: Engine moves first (Black perspective)');
await page.waitForTimeout(4000);
await screenshot('play-10-engine-first-black');

// Test 11: Take-back test
console.log('Test 10: Take-back functionality');
const whiteBtn = await page.$('[data-testid="side-white"]');
if (whiteBtn) {
  await whiteBtn.click();
  await page.waitForTimeout(500);
}
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(1000);
await clickPiece('e2');
await clickPiece('e4');
await page.waitForTimeout(2000);
await clickPiece('e7');
await clickPiece('e5');
await page.waitForTimeout(1000);
await screenshot('play-11-before-takeback');
const takebackBtn = await page.$('[data-testid="takeback-btn"]');
console.log('Takeback button disabled:', takebackBtn ? await takebackBtn.isEnabled() : 'not found');
if (takebackBtn && await takebackBtn.isEnabled()) {
  await takebackBtn.click();
  await page.waitForTimeout(1000);
  await screenshot('play-12-after-takeback');
}

// Test 12: Resign test
console.log('Test 11: Resign');
const resignBtn = await page.$('[data-testid="resign-btn"]');
if (resignBtn && await resignBtn.isEnabled()) {
  await resignBtn.click();
  await page.waitForTimeout(1000);
  await screenshot('play-13-resign');
}

// Test 13: New game after resign
console.log('Test 12: New game after resign');
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(2000);
await screenshot('play-14-new-after-resign');

// Test 14: Try illegal move
console.log('Test 13: Illegal move attempt');
await clickPiece('e2');
await page.waitForTimeout(300);
await clickPiece('e6'); // illegal pawn move
await page.waitForTimeout(500);
await screenshot('play-15-illegal-move');

// Test 15: Check for status/toast message
const statusEl = await page.$('[data-testid="play-status"]');
const statusText = statusEl ? await statusEl.textContent() : 'NOT FOUND';
console.log('Status text:', statusText);

// Test 16: Analyze handoff
console.log('Test 14: Analyze handoff');
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(1000);
await clickPiece('e2');
await clickPiece('e4');
await page.waitForTimeout(2000);
const analyzeBtn = await page.$('[data-testid="analyze-btn"]');
console.log('Analyze button found:', !!analyzeBtn);
if (analyzeBtn) {
  await analyzeBtn.click();
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  console.log('URL after analyze click:', currentUrl);
  await screenshot('play-16-analyze-handoff');
}

// Test 17: Visual quality check
console.log('Test 15: Visual quality');
await page.goto(`${BASE}/play`);
await page.waitForTimeout(2000);
await page.click('[data-testid="new-game-btn"]');
await page.waitForTimeout(1000);
await screenshot('play-17-visual-quality');

await browser.close();
console.log('\n=== ALL TESTS COMPLETED ===');
