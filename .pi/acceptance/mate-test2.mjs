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
        // Fool's mate — white is in checkmate, white to move
        worker.postMessage('position fen rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
        worker.postMessage('go depth 8');
      }
      count++;
      if (count > 60) resolve(lines.slice(-15));
    };
    worker.postMessage('uci');
    worker.postMessage('isready');
    setTimeout(() => resolve({ timeout: true, lines: lines.slice(-10) }), 12000);
  });
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
