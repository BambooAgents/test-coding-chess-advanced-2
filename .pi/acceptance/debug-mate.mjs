import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5183/test-coding-chess-advanced-2/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const mateFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'; // fool's mate pos
// Actually use the Opera game's mate position: after 17.Rd8#
// Let me compute it
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1000);

// Test getEvaluation on a checkmate position directly via the engine
const result = await page.evaluate(async () => {
  // Use the worker directly.
  const worker = new Worker('/test-coding-chess-advanced-2/stockfish/stockfish.wasm.js', { type: 'classic' });
  return new Promise((resolve) => {
    const lines = [];
    let resolved = false;
    worker.onmessage = (e) => {
      const msg = typeof e.data === 'string' ? e.data : (e.data?.data ?? '');
      lines.push(msg);
      if (msg === 'uciok') {
        worker.postMessage('isready');
      }
      if (msg === 'readyok') {
        // Opera mate position: after 17.Rd8# - black king on e8, rook on d8 giving mate
        // FEN of the mated position
        worker.postMessage('position fen r1b1k1nr/pppp1ppp/2n5/1B2p3/4P1b1/5N2/PPPP1PPP/RNB1K2R b KQkq - 0 6');
        // Actually let me use a known checkmate: fool's mate
        worker.postMessage('position fen rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
        worker.postMessage('go depth 8');
      }
      if (msg.startsWith('bestmove') || msg.includes('mate 0')) {
        if (!resolved) {
          resolved = true;
          setTimeout(() => { resolve(lines); }, 500);
        }
      }
    };
    worker.postMessage('uci');
    setTimeout(() => resolve({ timeout: true, lines: lines.slice(-20) }), 15000);
  });
});

console.log('Engine output on mate position:');
console.log(JSON.stringify(result, null, 2));
await browser.close();
