import { chromium } from 'playwright';
const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const issues = [];
for (const [name, path] of [['home',''],['puzzles','puzzles'],['play','play'],['weaknesses','weaknesses']]) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const problems = [];
    // Check for overlapping elements (nav + content)
    const nav = document.querySelector('nav, [class*="nav"], [class*="Nav"]');
    const main = document.querySelector('main, [class*="main"], [class*="Main"]');
    if (nav && main) {
      const nr = nav.getBoundingClientRect();
      const mr = main.getBoundingClientRect();
      if (nr.bottom > mr.top + 2) problems.push({issue:'nav overlaps main', navBottom: nr.bottom, mainTop: mr.top});
    }
    // Check for text overflow / clipping in buttons
    document.querySelectorAll('button, a').forEach(el => {
      if (el.scrollWidth > el.clientWidth + 2) {
        problems.push({issue:'text-overflow', tag: el.tagName, text: el.textContent?.slice(0,30), scrollW: el.scrollWidth, clientW: el.clientWidth});
      }
    });
    // Check for elements with no visible content (transparent text)
    document.querySelectorAll('span, div').forEach(el => {
      if (el.children.length === 0 && el.textContent?.trim() && el.textContent.trim().length < 10) {
        const s = window.getComputedStyle(el);
        if (s.color === 'rgba(0, 0, 0, 0)' && s.backgroundColor === 'rgba(0, 0, 0, 0)') {
          // text exists but invisible
          if (!['', ' '].includes(el.textContent)) {
            problems.push({issue:'invisible-text', tag: el.tagName, text: el.textContent, class: el.className?.slice(0,40)});
          }
        }
      }
    });
    return { url: location.pathname, problems: problems.slice(0, 8), title: document.title };
  });
  console.log(`\n=== ${name} (${path}) ===`);
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: `.pi/acceptance/audit-${name}.png`, fullPage: true });
}
await browser.close();
