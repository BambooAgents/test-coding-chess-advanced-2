import { chromium } from 'playwright';
const BASE = 'http://localhost:5184/test-coding-chess-advanced-2/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 }).catch(()=>{});
await page.waitForTimeout(2000);

// Check adopted stylesheets (styled-components v6 may use these)
const adopted = await page.evaluate(() => {
  const results = [];
  // Check document.adoptedStyleSheets
  if (document.adoptedStyleSheets) {
    for (const sheet of document.adoptedStyleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.cssText && rule.cssText.includes('kLwfci')) {
            results.push(rule.cssText);
          }
        }
      } catch(e) { results.push('error: ' + e.message); }
    }
  }
  
  // Also check shadow roots
  document.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      for (const sheet of el.shadowRoot.adoptedStyleSheets || []) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.cssText && rule.cssText.includes('kLwfci')) {
              results.push('shadow: ' + rule.cssText);
            }
          }
        } catch(e) {}
      }
    }
  });
  
  return { adoptedCount: document.adoptedStyleSheets?.length, rules: results };
});
console.log('ADOPTED STYLESHEETS:', JSON.stringify(adopted, null, 2));

// Also check all <style> tags
const styleTags = await page.evaluate(() => {
  const tags = document.querySelectorAll('style');
  const results = [];
  tags.forEach((t, i) => {
    if (t.textContent.includes('kLwfci')) {
      // Find the relevant part
      const idx = t.textContent.indexOf('kLwfci');
      results.push({ tagIndex: i, around: t.textContent.slice(Math.max(0, idx-50), idx+200) });
    }
  });
  return results;
});
console.log('\nSTYLE TAGS with kLwfci:', JSON.stringify(styleTags, null, 2));
await browser.close();
