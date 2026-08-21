import { chromium } from 'playwright';

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') console.log('CONSOLE:', msg.type(), msg.text().slice(0,300)); });
page.on('pageerror', err => console.log('PAGEERR:', err.message.slice(0,300)));

// Home page
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '.pi/acceptance/audit-home.png', fullPage: true });

// Analyze with Opera game
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
await page.locator('[data-testid="pgn-input"]').fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(15000); // wait for analysis
await page.screenshot({ path: '.pi/acceptance/audit-analyze.png', fullPage: true });

// Inspect the move list rendering — check how badges are styled
const moveListInfo = await page.evaluate(() => {
  // Find the move list
  const moveRows = document.querySelectorAll('[data-testid="move-row"], [class*="move"], [class*="Move"]');
  const info = [];
  moveRows.forEach((row, i) => {
    if (i < 10) {
      const styles = window.getComputedStyle(row);
      info.push({
        text: row.textContent?.slice(0, 50),
        className: row.className,
        color: styles.color,
        bg: styles.backgroundColor,
        fontSize: styles.fontSize,
        display: styles.display,
        visibility: styles.visibility,
        overflow: styles.overflow,
        rect: row.getBoundingClientRect(),
      });
    }
  });

  // Also check the overall page layout for overlap/clipping
  const body = document.body;
  const bodyStyles = window.getComputedStyle(body);
  const allElements = document.querySelectorAll('*');
  const problems = [];
  allElements.forEach((el, i) => {
    if (i > 200) return; // limit
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    // Check for elements that are clipped or off-screen
    if (rect.width > 0 && rect.height > 0) {
      if (rect.right > window.innerWidth + 5 || rect.bottom > window.innerHeight + 5) {
        problems.push({
          tag: el.tagName,
          class: el.className?.slice(0, 60),
          text: el.textContent?.slice(0, 40),
          rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height, right: rect.right, bottom: rect.bottom },
          issue: 'off-screen',
        });
      }
      if (styles.overflow === 'hidden' && el.scrollWidth > el.clientWidth) {
        problems.push({
          tag: el.tagName,
          class: el.className?.slice(0, 60),
          text: el.textContent?.slice(0, 40),
          issue: 'clipped-text',
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        });
      }
    }
  });

  return { moveRows: info, layoutProblems: problems.slice(0, 15), moveRowCount: moveRows.length };
});

console.log('MOVE ROWS:', moveListInfo.moveRowCount);
console.log('First 5 move rows:', JSON.stringify(moveListInfo.moveRows.slice(0, 5), null, 2));
console.log('\nLAYOUT PROBLEMS:', JSON.stringify(moveListInfo.layoutProblems, null, 2));

// Check the eval bar + board rendering
const boardInfo = await page.evaluate(() => {
  const board = document.querySelector('[data-testid="chess-board"], [class*="board"], [class*="Board"]');
  const evalBar = document.querySelector('[class*="eval"], [class*="Eval"], [data-testid*="eval"]');
  const arrows = document.querySelectorAll('svg [class*="arrow"], svg line, svg path, [class*="arrow"]');

  return {
    board: board ? { 
      rect: board.getBoundingClientRect(),
      class: board.className,
      children: board.children.length,
    } : null,
    evalBar: evalBar ? {
      rect: evalBar.getBoundingClientRect(),
      class: evalBar.className,
      styles: { bg: window.getComputedStyle(evalBar).backgroundColor, w: window.getComputedStyle(evalBar).width },
    } : null,
    arrows: arrows.length,
  };
});
console.log('\nBOARD:', JSON.stringify(boardInfo, null, 2));

// Puzzles page
await page.goto(BASE + 'puzzles', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '.pi/acceptance/audit-puzzles.png', fullPage: true });

// Play page
await page.goto(BASE + 'play', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '.pi/acceptance/audit-play.png', fullPage: true });

// Weaknesses
await page.goto(BASE + 'weaknesses', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '.pi/acceptance/audit-weaknesses.png', fullPage: true });

await browser.close();
console.log('\nDone. Screenshots in .pi/acceptance/audit-*.png');
