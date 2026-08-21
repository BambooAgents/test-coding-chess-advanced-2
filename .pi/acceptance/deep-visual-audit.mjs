/**
 * Deep Visual Audit — reconstructs what's visually rendered using computed styles.
 * Since no vision model is available in this session, this script inspects
 * the actual computed CSS of every visible element to determine what the
 * user ACTUALLY sees. This is more precise than screenshot eyeballing for
 * specific questions like "is this badge transparent" or "is the eval bar
 * filled".
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const OPERA = '1.e4 e5 2.Nf3 d6 3.d4 Bg4 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5 b5 10.Nxb5 cxb5 11.Bxb5+ Nbd7 12.O-O-O Rd8 13.Rxd7 Rxd7 14.Rd1 Qe6 15.Bxd7+ Nxd7 16.Qb8+ Nxb8 17.Rd8#';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.setDefaultTimeout(30000);

const findings = [];

function log(category, severity, description, evidence) {
  findings.push({ category, severity, description, evidence });
  console.log(`[${severity.toUpperCase()}] ${category}: ${description}`);
  if (evidence) console.log(`  evidence: ${JSON.stringify(evidence).slice(0, 200)}`);
}

// ============================================================
// 1. HOME PAGE
// ============================================================
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const homeAudit = await page.evaluate(() => {
  const results = {};
  
  // Nav bar
  const nav = document.querySelector('nav, [class*="TopBar"], [class*="topbar"]');
  if (nav) {
    const r = nav.getBoundingClientRect();
    const s = window.getComputedStyle(nav);
    results.nav = { rect: {x:r.x,y:r.y,w:r.width,h:r.height}, bg: s.backgroundColor, position: s.position };
  }
  
  // Check all links/buttons are visible
  const navLinks = document.querySelectorAll('nav a, nav button, [class*="TopBar"] a, [class*="TopBar"] button');
  results.navLinks = [];
  navLinks.forEach(a => {
    const s = window.getComputedStyle(a);
    const r = a.getBoundingClientRect();
    results.navLinks.push({
      text: a.textContent?.trim(),
      color: s.color,
      visible: s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0,
    });
  });
  
  // Check main content area
  const main = document.querySelector('main, [class*="Main"], [class*="Content"]');
  if (main) {
    const r = main.getBoundingClientRect();
    results.main = { rect: {x:r.x,y:r.y,w:r.width,h:r.height} };
  }
  
  // Check for any invisible text (transparent color on visible elements)
  const invisibleTexts = [];
  document.querySelectorAll('h1, h2, h3, p, span, a, button, div').forEach(el => {
    if (el.children.length === 0 && el.textContent?.trim() && el.textContent.trim().length < 50) {
      const s = window.getComputedStyle(el);
      if (s.color === 'rgba(0, 0, 0, 0)' && s.visibility !== 'hidden' && s.display !== 'none') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          invisibleTexts.push({ tag: el.tagName, text: el.textContent.trim(), class: el.className?.toString().slice(0,50), color: s.color });
        }
      }
    }
  });
  results.invisibleTexts = invisibleTexts.slice(0, 10);
  
  return results;
});

if (homeAudit.invisibleTexts?.length > 0) {
  log('home', 'warn', 'Invisible text elements found on home page', homeAudit.invisibleTexts);
} else {
  log('home', 'pass', 'No invisible text on home page');
}
if (homeAudit.nav) {
  log('home', 'info', 'Nav bar present', homeAudit.nav);
}

// ============================================================
// 2. PUZZLES PAGE
// ============================================================
await page.goto(BASE + 'puzzles', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const puzzlesAudit = await page.evaluate(() => {
  const results = {};
  
  // Board
  const board = document.querySelector('[data-testid="chess-board"], [class*="board"]');
  if (board) {
    const r = board.getBoundingClientRect();
    results.board = { rect: {x:r.x,y:r.y,w:r.width,h:r.height}, childCount: board.children.length };
    // Check pieces
    const pieces = board.querySelectorAll('img');
    results.pieces = pieces.length;
    // Check first piece renders
    if (pieces[0]) {
      const pr = pieces[0].getBoundingClientRect();
      results.firstPiece = { rect: {x:pr.x,y:pr.y,w:pr.width,h:pr.height}, src: pieces[0].src.slice(-20) };
    }
  }
  
  // Puzzle info
  const body = document.body.innerText;
  results.bodyText = body.slice(0, 500);
  
  // Check for invisible text
  const invisibleTexts = [];
  document.querySelectorAll('span, div, p, h1, h2, h3, button, a').forEach(el => {
    if (el.children.length === 0 && el.textContent?.trim() && el.textContent.trim().length < 50) {
      const s = window.getComputedStyle(el);
      if (s.color === 'rgba(0, 0, 0, 0)' && s.visibility !== 'hidden' && s.display !== 'none') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          invisibleTexts.push({ tag: el.tagName, text: el.textContent.trim(), class: el.className?.toString().slice(0,50) });
        }
      }
    }
  });
  results.invisibleTexts = invisibleTexts.slice(0, 10);
  
  return results;
});

if (puzzlesAudit.board) {
  log('puzzles', 'info', 'Board renders', { size: puzzlesAudit.board.rect, pieces: puzzlesAudit.pieces });
}
if (puzzlesAudit.invisibleTexts?.length > 0) {
  log('puzzles', 'warn', 'Invisible text on puzzles page', puzzlesAudit.invisibleTexts);
} else {
  log('puzzles', 'pass', 'No invisible text on puzzles page');
}

// ============================================================
// 3. PLAY PAGE
// ============================================================
await page.goto(BASE + 'play', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const playAudit = await page.evaluate(() => {
  const results = {};
  const board = document.querySelector('[data-testid="chess-board"], [class*="board"]');
  if (board) {
    const r = board.getBoundingClientRect();
    results.board = { rect: {x:r.x,y:r.y,w:r.width,h:r.height}, pieces: board.querySelectorAll('img').length };
  }
  const body = document.body.innerText;
  results.bodyText = body.slice(0, 400);
  
  const invisibleTexts = [];
  document.querySelectorAll('span, div, p, h1, h2, h3, button, a').forEach(el => {
    if (el.children.length === 0 && el.textContent?.trim() && el.textContent.trim().length < 50) {
      const s = window.getComputedStyle(el);
      if (s.color === 'rgba(0, 0, 0, 0)' && s.visibility !== 'hidden' && s.display !== 'none') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          invisibleTexts.push({ tag: el.tagName, text: el.textContent.trim(), class: el.className?.toString().slice(0,50) });
        }
      }
    }
  });
  results.invisibleTexts = invisibleTexts.slice(0, 10);
  return results;
});

if (playAudit.invisibleTexts?.length > 0) {
  log('play', 'warn', 'Invisible text on play page', playAudit.invisibleTexts);
} else {
  log('play', 'pass', 'No invisible text on play page');
}

// ============================================================
// 4. WEAKNESSES PAGE
// ============================================================
await page.goto(BASE + 'weaknesses', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

const weaknessesAudit = await page.evaluate(() => {
  const results = {};
  const body = document.body.innerText;
  results.bodyText = body.slice(0, 400);
  const invisibleTexts = [];
  document.querySelectorAll('span, div, p, h1, h2, h3, button, a, label, input').forEach(el => {
    if (el.children.length === 0 && el.textContent?.trim() && el.textContent.trim().length < 50) {
      const s = window.getComputedStyle(el);
      if (s.color === 'rgba(0, 0, 0, 0)' && s.visibility !== 'hidden' && s.display !== 'none') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          invisibleTexts.push({ tag: el.tagName, text: el.textContent.trim(), class: el.className?.toString().slice(0,50) });
        }
      }
    }
  });
  results.invisibleTexts = invisibleTexts.slice(0, 10);
  return results;
});

if (weaknessesAudit.invisibleTexts?.length > 0) {
  log('weaknesses', 'warn', 'Invisible text on weaknesses page', weaknessesAudit.invisibleTexts);
} else {
  log('weaknesses', 'pass', 'No invisible text on weaknesses page');
}

// ============================================================
// 5. ANALYZE PAGE — THE KEY ONE
// ============================================================
await page.goto(BASE + 'analyze', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

// Load Opera Game PGN
await page.locator('[data-testid="pgn-input"]').fill(OPERA);
await page.locator('button:has-text("Load PGN")').click();
await page.waitForTimeout(12000); // Wait for analysis

// 5a. Check the full analyze page state after analysis
const analyzeAudit = await page.evaluate(() => {
  const results = {};
  
  // --- EVAL BAR ---
  // Find eval bar (24px wide, left of board)
  const evalBar = document.querySelector('[data-testid="eval-bar"]');
  if (evalBar) {
    const r = evalBar.getBoundingClientRect();
    const s = window.getComputedStyle(evalBar);
    results.evalBar = { 
      rect: {x:r.x,y:r.y,w:r.width,h:r.height}, 
      bg: s.backgroundColor,
      innerHTML: evalBar.innerHTML.slice(0, 300),
    };
    
    // Check the fill (WhiteFill)
    const fill = evalBar.querySelector('div');
    if (fill) {
      const fs = window.getComputedStyle(fill);
      const fr = fill.getBoundingClientRect();
      results.evalBarFill = {
        rect: {x:fr.x,y:fr.y,w:fr.width,h:fr.height},
        height: fs.height,
        bg: fs.backgroundColor,
        visible: fr.height > 2,
      };
    }
    
    // Check eval labels
    const labels = evalBar.querySelectorAll('span, div');
    results.evalLabels = [];
    labels.forEach(l => {
      if (l.textContent?.trim()) {
        const ls = window.getComputedStyle(l);
        results.evalLabels.push({
          text: l.textContent.trim(),
          color: ls.color,
          visible: ls.color !== 'rgba(0, 0, 0, 0)' && ls.visibility !== 'hidden',
        });
      }
    });
  } else {
    results.evalBar = null;
    // Try to find by position
    document.querySelectorAll('div').forEach(d => {
      const r = d.getBoundingClientRect();
      if (r.width >= 15 && r.width <= 40 && r.height > 200) {
        if (!results.evalBarFallback) {
          const s = window.getComputedStyle(d);
          results.evalBarFallback = { class: d.className, rect: {x:r.x,y:r.y,w:r.width,h:r.height}, bg: s.backgroundColor, html: d.innerHTML.slice(0, 200) };
        }
      }
    });
  }
  
  // --- BOARD ---
  const board = document.querySelector('[data-testid="chess-board"]');
  if (board) {
    const r = board.getBoundingClientRect();
    results.board = { rect: {x:r.x,y:r.y,w:r.width,h:r.height}, pieces: board.querySelectorAll('img').length };
    
    // Check for arrows
    const arrows = board.querySelector('[data-testid="board-arrows"]');
    if (arrows) {
      const ar = arrows.getBoundingClientRect();
      results.boardArrows = { 
        present: true, 
        svgChildren: arrows.querySelectorAll('line, path, polygon').length,
        html: arrows.outerHTML.slice(0, 200),
      };
    } else {
      results.boardArrows = { present: false };
    }
  }
  
  // --- MOVE LIST + BADGES ---
  const body = document.body.innerText;
  results.bodyText = body.slice(0, 1000);
  
  // Find all badge elements (spans containing classification glyphs)
  const glyphs = ['!!', '!', '?!', '?', '??', ''];
  const badgeEls = [];
  document.querySelectorAll('span').forEach(el => {
    const text = el.textContent?.trim();
    if (text && glyphs.includes(text) && text !== '') {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      badgeEls.push({
        text: text,
        glyph: text,
        color: s.color,
        bg: s.backgroundColor,
        fontWeight: s.fontWeight,
        fontSize: s.fontSize,
        visible: s.color !== 'rgba(0, 0, 0, 0)' && r.width > 0 && r.height > 0,
        class: el.className?.toString().slice(0, 50),
        rect: {x:r.x, y:r.y, w:r.width, h:r.height},
      });
    }
  });
  results.badges = badgeEls;
  
  // Specifically check the "!!" brilliant badge
  results.brilliantBadges = badgeEls.filter(b => b.text === '!!');
  
  // --- ACCURACY DISPLAY ---
  const accMatch = body.match(/accuracy[:\s]+([\d.]+)%/gi);
  results.accuracy = accMatch;
  
  // --- PROGRESS INDICATOR ---
  results.analyzingText = body.includes('Analyzing') ? 'still analyzing' : 'analysis complete';
  const progressMatch = body.match(/(\d+)\s*\/\s*(\d+)/);
  results.progress = progressMatch ? `${progressMatch[1]}/${progressMatch[2]}` : null;
  
  // --- CURRENT PLY ---
  // The scrubber shows "0 / 33" or similar
  const scrubMatch = body.match(/(\d+)\s*\/\s*(\d+)/g);
  results.scrubber = scrubMatch ? scrubMatch.slice(0, 3) : null;
  
  // --- INVISIBLE TEXT ---
  const invisibleTexts = [];
  document.querySelectorAll('span, div, p, button, a').forEach(el => {
    if (el.children.length === 0 && el.textContent?.trim() && el.textContent.trim().length < 50) {
      const s = window.getComputedStyle(el);
      if (s.color === 'rgba(0, 0, 0, 0)' && s.visibility !== 'hidden' && s.display !== 'none') {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          invisibleTexts.push({ 
            tag: el.tagName, 
            text: el.textContent.trim(), 
            class: el.className?.toString().slice(0,50),
            rect: {x:r.x, y:r.y, w:r.width, h:r.height},
          });
        }
      }
    }
  });
  results.invisibleTexts = invisibleTexts.slice(0, 15);
  
  return results;
});

console.log('\n=== ANALYZE AUDIT (after analysis, ply=0) ===');
console.log(JSON.stringify(analyzeAudit, null, 2));

// 5b. Now scrub to ply 10 (the Nxb5 brilliant move) and check again
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')];
    const next = btns.find(b => b.textContent?.includes('▶') || b.textContent?.includes('Next'));
    if (next) next.click();
  });
  await page.waitForTimeout(200);
}
await page.waitForTimeout(500);

const scrubbedAudit = await page.evaluate(() => {
  const results = {};
  
  // Eval bar at ply 10
  const evalBar = document.querySelector('[data-testid="eval-bar"]');
  if (evalBar) {
    const fill = evalBar.querySelector('div');
    if (fill) {
      const fs = window.getComputedStyle(fill);
      const fr = fill.getBoundingClientRect();
      results.evalBarFill = { height: fs.height, bg: fs.backgroundColor, rect: {h: fr.height} };
    }
    const labels = evalBar.querySelectorAll('span, div');
    results.evalLabels = [];
    labels.forEach(l => {
      if (l.textContent?.trim()) {
        const ls = window.getComputedStyle(l);
        results.evalLabels.push({ text: l.textContent.trim(), color: ls.color, visible: ls.color !== 'rgba(0, 0, 0, 0)' });
      }
    });
  }
  
  // Arrows at ply 10
  const board = document.querySelector('[data-testid="chess-board"]');
  if (board) {
    const arrows = board.querySelector('[data-testid="board-arrows"]');
    results.arrows = arrows ? { present: true, children: arrows.querySelectorAll('line, path, polygon').length, html: arrows.outerHTML.slice(0,200) } : { present: false };
  }
  
  // Badges — find ALL, check visibility
  const badgeEls = [];
  document.querySelectorAll('span').forEach(el => {
    const text = el.textContent?.trim();
    if (text && ['!!', '!', '?!', '?', '??'].includes(text)) {
      const s = window.getComputedStyle(el);
      const r = el.getBoundingClientRect();
      badgeEls.push({
        text: text,
        color: s.color,
        visible: s.color !== 'rgba(0, 0, 0, 0)' && r.width > 0,
        class: el.className?.toString().slice(0, 50),
      });
    }
  });
  results.badges = badgeEls;
  results.brilliantBadges = badgeEls.filter(b => b.text === '!!');
  
  // Scrubber position
  const body = document.body.innerText;
  const scrubMatch = body.match(/(\d+)\s*\/\s*(\d+)/g);
  results.scrubber = scrubMatch;
  
  return results;
});

console.log('\n=== ANALYZE AUDIT (after scrubbing to ply 10) ===');
console.log(JSON.stringify(scrubbedAudit, null, 2));

// 5c. Check the MoveRow styling for badges — what color does each classification get?
const moveRowAudit = await page.evaluate(() => {
  // Find the Badge styled component's actual rendered styles
  const allSpans = document.querySelectorAll('span');
  const badgeData = [];
  allSpans.forEach(s => {
    const text = s.textContent?.trim();
    if (text && ['!!', '!', '?!', '?', '??', ''].includes(text) && text !== '') {
      const styles = window.getComputedStyle(s);
      const parent = s.parentElement;
      const parentStyles = parent ? window.getComputedStyle(parent) : null;
      badgeData.push({
        text: text,
        color: styles.color,
        bg: styles.backgroundColor,
        fontWeight: styles.fontWeight,
        parentTag: parent?.tagName,
        parentColor: parentStyles?.color,
        parentBg: parentStyles?.backgroundColor,
      });
    }
  });
  return badgeData;
});
console.log('\n=== BADGE STYLES (all badges on page) ===');
console.log(JSON.stringify(moveRowAudit, null, 2));

// ============================================================
// 6. OVERALL LAYOUT CHECK — look for overlap/clipping
// ============================================================
const layoutAudit = await page.evaluate(() => {
  const issues = [];
  
  // Check if board overlaps with eval bar
  const board = document.querySelector('[data-testid="chess-board"]');
  const evalBar = document.querySelector('[data-testid="eval-bar"]');
  if (board && evalBar) {
    const br = board.getBoundingClientRect();
    const er = evalBar.getBoundingClientRect();
    if (er.right > br.left) {
      issues.push({ issue: 'eval bar overlaps board', evalRight: er.right, boardLeft: br.left });
    }
  }
  
  // Check if move list overlaps with board
  const moveList = document.querySelector('[class*="MoveList"], [class*="move-list"], [data-testid="move-list"]');
  if (board && moveList) {
    const br = board.getBoundingClientRect();
    const mr = moveList.getBoundingClientRect();
    if (mr.left < br.right && mr.right > br.left) {
      issues.push({ issue: 'move list overlaps board', moveLeft: mr.left, boardRight: br.right });
    }
  }
  
  // Check page height vs viewport
  const bodyHeight = document.body.scrollHeight;
  const viewportHeight = window.innerHeight;
  if (bodyHeight > viewportHeight + 50) {
    issues.push({ issue: 'page taller than viewport', bodyHeight, viewportHeight, overflow: bodyHeight - viewportHeight });
  }
  
  // Check for horizontal overflow
  if (document.body.scrollWidth > window.innerWidth + 5) {
    issues.push({ issue: 'horizontal overflow', scrollWidth: document.body.scrollWidth, viewportWidth: window.innerWidth });
  }
  
  return issues;
});

console.log('\n=== LAYOUT ISSUES ===');
console.log(JSON.stringify(layoutAudit, null, 2));

await browser.close();

// Write the full findings
import { writeFileSync } from 'fs';
writeFileSync('.pi/acceptance/visual-audit-results.json', JSON.stringify({
  home: homeAudit,
  puzzles: puzzlesAudit,
  play: playAudit,
  weaknesses: weaknessesAudit,
  analyze_ply0: analyzeAudit,
  analyze_ply10: scrubbedAudit,
  badgeStyles: moveRowAudit,
  layoutIssues: layoutAudit,
  findings: findings,
}, null, 2));

console.log('\n\n=== SUMMARY OF FINDINGS ===');
findings.forEach(f => console.log(`[${f.severity}] ${f.category}: ${f.description}`));
