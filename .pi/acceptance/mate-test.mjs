import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5183/test-coding-chess-advanced-2/', { waitUntil: 'domcontentloaded' });
const result = await page.evaluate(async () => {
  const worker = new Worker('/test-coding-chess-advanced-2/stockfish/stockfish.wasm.js', { type: 'classic' });
  return new Promise((resolve) => {
    const lines = [];
    let count = 0;
    worker.onmessage = (e) => {
      const msg = typeof e.data === 'string' ? e.data : (e.data?.data ?? '');
      lines.push(msg);
      if (msg === 'readyok') {
        // Opera final position after 17.Rd8# — black is in checkmate
        worker.postMessage('position fen 1n1Rkb1r/pppp1ppp/8/4p3/8/8/PPPP1PPP/2BQK1NR b Kk - 0 17');
        worker.postMessage('go depth 8');
      }
      count++;
      if (count > 50) resolve(lines);
    };
    worker.postMessage('uci');
    worker.postMessage('isready');
    setTimeout(() => resolve({ timeout: true, lines: lines.slice(-10) }), 10000);
  });
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
