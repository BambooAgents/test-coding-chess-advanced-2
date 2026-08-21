/**
 * Play Page Acceptance Review Script - REVISED
 * 
 * Tests all Play page features via Playwright DOM inspection.
 * NO screenshot reading - all visual checks via getComputedStyle, getBoundingClientRect, innerText.
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5183/test-coding-chess-advanced-2';

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  const findings = [];
  
  try {
    // Test 1: Start game as White vs Easy - make e4, engine replies
    console.log('\n=== TEST 1: Start game as White vs Easy ===');
    await page.goto(`${BASE_URL}/play`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="play-status"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="chess-board"]', { timeout: 10000 });
    
    await page.selectOption('[data-testid="strength-select"]', 'Easy');
    await page.click('[data-testid="side-white"]');
    await page.click('[data-testid="new-game-btn"]');
    
    await page.waitForTimeout(500);
    let statusText = await page.textContent('[data-testid="play-status"]');
    console.log('Initial status:', statusText);
    
    const e2Square = page.locator('[data-square="e2"]');
    const e4Square = page.locator('[data-square="e4"]');
    
    await e2Square.click();
    await page.waitForTimeout(300);
    
    // Check for ::after pseudo-element (legal move indicator)
    const e4Pseudo = await e4Square.evaluate((el) => {
      const style = window.getComputedStyle(el, '::after');
      return {
        opacity: style.opacity,
        backgroundColor: style.backgroundColor,
        width: style.width,
        height: style.height,
      };
    });
    console.log('e4 ::after pseudo-element:', e4Pseudo);
    
    await e4Square.click();
    await page.waitForTimeout(2000);
    
    const moveList = page.locator('[data-testid="move-list"]');
    let moveText = await moveList.textContent();
    console.log('Move list after e4:', moveText);
    
    statusText = await page.textContent('[data-testid="play-status"]');
    console.log('Status after engine move:', statusText);
    
    const boardRect = await page.locator('[data-testid="chess-board"]').boundingBox();
    console.log('Board dimensions:', boardRect);
    
    if (moveText.trim().length === 0) {
      findings.push({
        severity: 'BLOCKER',
        id: 'B1',
        where: 'Play page - Easy difficulty',
        what: 'Engine does not reply after player move',
        evidence: `Move list empty after e4, status: ${statusText}`,
        whyItMatters: 'Game is unplayable if engine does not respond'
      });
    }
    
    // Test 2: Expert difficulty
    console.log('\n=== TEST 2: Expert difficulty ===');
    await page.selectOption('[data-testid="strength-select"]', 'Expert');
    await page.click('[data-testid="new-game-btn"]');
    
    await e2Square.click();
    await page.waitForTimeout(300);
    await e4Square.click();
    
    console.log('Waiting for Expert engine move (depth=18)...');
    await page.waitForTimeout(15000);
    
    moveText = await moveList.textContent();
    console.log('Move list after Expert move:', moveText);
    
    if (!moveText.includes('e4')) {
      findings.push({
        severity: 'IMPORTANT',
        id: 'I1',
        where: 'Play page - Expert difficulty',
        what: 'Expert engine move may be too slow or not completing',
        evidence: `Move list after 15s wait: ${moveText.substring(0, 100)}`,
        whyItMatters: 'Expert level may be unusable due to long wait times'
      });
    }
    
    // Test 3: Play as Black
    console.log('\n=== TEST 3: Play as Black ===');
    await page.click('[data-testid="side-black"]');
    await page.waitForTimeout(1000);
    
    statusText = await page.textContent('[data-testid="play-status"]');
    console.log('Status as Black:', statusText);
    
    const boardRect2 = await page.locator('[data-testid="chess-board"]').boundingBox();
    console.log('Board dimensions (Black):', boardRect2);
    
    const pieces = page.locator('[alt^="wK"], [alt^="wQ"], [alt^="bK"], [alt^="bQ"]');
    const pieceCount = await pieces.count();
    console.log('Piece count on flipped board:', pieceCount);
    
    // Test 4: Take-back
    console.log('\n=== TEST 4: Take-back ===');
    await page.click('[data-testid="side-white"]');
    await page.selectOption('[data-testid="strength-select"]', 'Easy');
    await page.click('[data-testid="new-game-btn"]');
    
    await e2Square.click();
    await page.waitForTimeout(300);
    await e4Square.click();
    await page.waitForTimeout(2000);
    
    moveText = await moveList.textContent();
    console.log('Move list before takeback:', moveText);
    
    await page.click('[data-testid="takeback-btn"]');
    await page.waitForTimeout(500);
    
    moveText = await moveList.textContent();
    console.log('Move list after takeback:', moveText);
    
    const e2Content = await page.locator('[data-square="e2"]').innerHTML();
    console.log('e2 square content after takeback:', e2Content.substring(0, 100));
    
    // Test 5: Resign
    console.log('\n=== TEST 5: Resign ===');
    await page.click('[data-testid="new-game-btn"]');
    
    await e2Square.click();
    await page.waitForTimeout(300);
    await e4Square.click();
    await page.waitForTimeout(500);
    
    await page.click('[data-testid="resign-btn"]');
    await page.waitForTimeout(500);
    
    statusText = await page.textContent('[data-testid="play-status"]');
    console.log('Status after resign:', statusText);
    
    const resignDisabled = await page.locator('[data-testid="resign-btn"]').isDisabled();
    console.log('Resign button disabled:', resignDisabled);
    
    if (!statusText.toLowerCase().includes('resign')) {
      findings.push({
        severity: 'BLOCKER',
        id: 'B2',
        where: 'Play page - Resign feature',
        what: 'Resign does not update status message',
        evidence: `Status after resign: ${statusText}`,
        whyItMatters: 'User cannot confirm game ended by resignation'
      });
    }
    
    // Test 6: New game after resign
    console.log('\n=== TEST 6: New game after resign ===');
    await page.click('[data-testid="new-game-btn"]');
    await page.waitForTimeout(500);
    
    statusText = await page.textContent('[data-testid="play-status"]');
    console.log('Status after new game:', statusText);
    
    moveText = await moveList.textContent();
    console.log('Move list after new game:', moveText);
    
    if (statusText.toLowerCase().includes('resign')) {
      findings.push({
        severity: 'BLOCKER',
        id: 'B3',
        where: 'Play page - New game after resign',
        what: 'New game does not reset resignation state',
        evidence: `Status still shows resign: ${statusText}`,
        whyItMatters: 'Cannot start fresh game after resigning'
      });
    }
    
    // Test 7: Legal move highlights (check ::after pseudo-element)
    console.log('\n=== TEST 7: Legal move highlights ===');
    await page.click('[data-testid="new-game-btn"]');
    
    const b1Square = page.locator('[data-square="b1"]');
    const a3Square = page.locator('[data-square="a3"]');
    const c3Square = page.locator('[data-square="c3"]');
    
    await b1Square.click();
    await page.waitForTimeout(300);
    
    // Check ::after pseudo-element for legal move indicators
    const a3Pseudo = await a3Square.evaluate((el) => {
      const style = window.getComputedStyle(el, '::after');
      return {
        opacity: style.opacity,
        backgroundColor: style.backgroundColor,
        width: style.width,
        height: style.height,
      };
    });
    
    const c3Pseudo = await c3Square.evaluate((el) => {
      const style = window.getComputedStyle(el, '::after');
      return {
        opacity: style.opacity,
        backgroundColor: style.backgroundColor,
        width: style.width,
        height: style.height,
      };
    });
    
    console.log('a3 ::after pseudo-element:', a3Pseudo);
    console.log('c3 ::after pseudo-element:', c3Pseudo);
    
    // Legal moves should have opacity > 0 (the ChessBoard sets opacity: 0.4 for legal moves)
    const a3HasIndicator = parseFloat(a3Pseudo.opacity) > 0.1;
    const c3HasIndicator = parseFloat(c3Pseudo.opacity) > 0.1;
    console.log('a3 has indicator:', a3HasIndicator);
    console.log('c3 has indicator:', c3HasIndicator);
    
    if (!a3HasIndicator && !c3HasIndicator) {
      findings.push({
        severity: 'IMPORTANT',
        id: 'I2',
        where: 'Play page - Legal move highlights',
        what: 'Legal destination squares not highlighted (::after pseudo-element has opacity 0)',
        evidence: `a3: ${JSON.stringify(a3Pseudo)}, c3: ${JSON.stringify(c3Pseudo)}`,
        whyItMatters: 'Users cannot see which moves are legal'
      });
    }
    
    // Test 8: Illegal move feedback
    console.log('\n=== TEST 8: Illegal move feedback ===');
    await page.click('[data-testid="new-game-btn"]');
    
    const d3Square = page.locator('[data-square="d3"]');
    
    await e2Square.click();
    await page.waitForTimeout(300);
    await d3Square.click();
    await page.waitForTimeout(1000);
    
    // Check for toast - the Toast component uses fixed positioning
    const allDivs = await page.locator('div').all();
    let foundIllegalToast = false;
    let toastContent = '';
    
    for (const div of allDivs) {
      try {
        const text = await div.textContent();
        const style = await div.evaluate((el) => {
          const s = window.getComputedStyle(el);
          return {
            position: s.position,
            backgroundColor: s.backgroundColor,
          };
        });
        
        if (text && text.toLowerCase().includes('illegal')) {
          foundIllegalToast = true;
          toastContent = text;
          console.log('Found toast in div:', { text, style });
          break;
        }
      } catch (e) {
        // Skip
      }
    }
    
    console.log('Illegal move toast found:', foundIllegalToast, 'content:', toastContent);
    
    if (!foundIllegalToast) {
      findings.push({
        severity: 'IMPORTANT',
        id: 'I3',
        where: 'Play page - Illegal move feedback',
        what: 'No feedback shown when attempting illegal move',
        evidence: 'No element with "Illegal" text found after attempting illegal move',
        whyItMatters: 'Users do not know why their move was rejected'
      });
    }
    
    // Test 9: Analyze handoff
    console.log('\n=== TEST 9: Analyze handoff ===');
    await page.click('[data-testid="new-game-btn"]');
    
    await e2Square.click();
    await page.waitForTimeout(300);
    await e4Square.click();
    await page.waitForTimeout(2000);
    
    const analyzeBtn = page.locator('[data-testid="analyze-btn"]');
    const analyzeEnabled = await analyzeBtn.isEnabled();
    console.log('Analyze button enabled:', analyzeEnabled);
    
    if (analyzeEnabled) {
      await analyzeBtn.click();
      await page.waitForTimeout(1000);
      
      const currentUrl = page.url();
      console.log('URL after analyze click:', currentUrl);
      
      if (!currentUrl.includes('/analyze')) {
        findings.push({
          severity: 'BLOCKER',
          id: 'B4',
          where: 'Play page - Analyze handoff',
          what: 'Analyze button does not navigate to /analyze page',
          evidence: `URL after click: ${currentUrl}`,
          whyItMatters: 'Cannot analyze games from Play page'
        });
      } else {
        // Check for PGN textarea
        const textarea = page.locator('textarea');
        const textareaVisible = await textarea.isVisible({ timeout: 5000 });
        console.log('PGN textarea visible:', textareaVisible);
        
        if (textareaVisible) {
          const pgnContent = await textarea.inputValue();
          console.log('PGN content length:', pgnContent.length);
          console.log('PGN content preview:', pgnContent.substring(0, 200));
          
          if (pgnContent.length === 0) {
            findings.push({
              severity: 'BLOCKER',
              id: 'B6',
              where: 'Analyze page - PGN import',
              what: 'PGN textarea empty after handoff from Play page',
              evidence: `PGN content length: 0, URL: ${currentUrl}`,
              whyItMatters: 'Game data not transferred to analyze page - feature is broken'
            });
          }
        }
      }
    }
    
    // Test 10: Visual quality
    console.log('\n=== TEST 10: Visual quality ===');
    await page.goto(`${BASE_URL}/play`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-testid="play-status"]', { timeout: 10000 });
    
    let invisibleTextCount = 0;
    let zeroHeightCount = 0;
    let offScreenCount = 0;
    
    const allElements = await page.locator('*:not(style):not(script)').all();
    
    for (const el of allElements.slice(0, 100)) {
      try {
        const style = await el.evaluate((node) => {
          const el = node;
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            color: style.color,
            height: rect.height,
            width: rect.width,
            left: rect.left,
            top: rect.top,
            position: style.position,
          };
        });
        
        if (style.color.includes('rgba(0, 0, 0, 0)') || style.color === 'rgba(0,0,0,0)') {
          invisibleTextCount++;
        }
        
        const textContent = await el.textContent();
        if (textContent && textContent.trim().length > 0 && style.height === 0) {
          zeroHeightCount++;
        }
        
        const viewport = page.viewportSize() || { width: 1280, height: 720 };
        if ((style.left < -1000 || style.top < -1000 || 
            style.left > viewport.width + 1000 || style.top > viewport.height + 1000) &&
            (style.position === 'absolute' || style.position === 'fixed')) {
          offScreenCount++;
        }
      } catch (e) {
        // Skip elements that can't be evaluated
      }
    }
    
    console.log('Invisible text elements:', invisibleTextCount);
    console.log('Zero-height elements with content:', zeroHeightCount);
    console.log('Off-screen positioned elements:', offScreenCount);
    
    if (invisibleTextCount >= 5) {
      findings.push({
        severity: 'IMPORTANT',
        id: 'I5',
        where: 'Play page - Visual quality',
        what: `Found ${invisibleTextCount} text elements with invisible color`,
        evidence: 'Text color rgba(0,0,0,0) detected',
        whyItMatters: 'Text is unreadable to users'
      });
    }
    
    if (zeroHeightCount >= 5) {
      findings.push({
        severity: 'IMPORTANT',
        id: 'I6',
        where: 'Play page - Visual quality',
        what: `Found ${zeroHeightCount} elements with content but zero height`,
        evidence: 'Elements have text but height=0',
        whyItMatters: 'Content is not visible'
      });
    }
    
  } catch (error) {
    console.error('Test error:', error);
    findings.push({
      severity: 'BLOCKER',
      id: 'B5',
      where: 'Play page - General',
      what: 'Test execution failed',
      evidence: error.message,
      whyItMatters: 'Cannot verify page functionality'
    });
  } finally {
    await browser.close();
  }
  
  return findings;
}

// Run tests
runTests().then((findings) => {
  console.log('\n\n=== FINDINGS SUMMARY ===');
  findings.forEach(f => {
    console.log(`${f.id} [${f.severity}] ${f.where}: ${f.what}`);
  });
  
  const blockers = findings.filter(f => f.severity === 'BLOCKER').length;
  const importants = findings.filter(f => f.severity === 'IMPORTANT').length;
  const nits = findings.filter(f => f.severity === 'NIT').length;
  
  console.log(`\nTotal: ${findings.length} findings (${blockers} BLOCKER, ${importants} IMPORTANT, ${nits} NIT)`);
  
  // Output findings as JSON for report generation
  console.log('\n=== FINDINGS JSON ===');
  console.log(JSON.stringify(findings, null, 2));
  
  process.exit(blockers > 0 ? 1 : 0);
}).catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
