import { describe, it, expect, vi } from 'vitest'
import { StockfishEngine } from '../src/engine/StockfishEngine'

describe('StockfishEngine', () => {
  it('should be constructable', () => {
    const engine = new StockfishEngine()
    expect(engine).toBeDefined()
    expect(engine).toBeInstanceOf(StockfishEngine)
    engine.destroy()
  })

  it('should throw if getBestMove is called before init', async () => {
    const engine = new StockfishEngine()
    await expect(
      engine.getBestMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).rejects.toThrow('Stockfish not initialized')
    engine.destroy()
  })

  it('should expose setSkillLevel and destroy methods', () => {
    const engine = new StockfishEngine()
    expect(typeof engine.setSkillLevel).toBe('function')
    expect(typeof engine.destroy).toBe('function')
    expect(typeof engine.init).toBe('function')
    expect(typeof engine.getBestMove).toBe('function')
    expect(typeof engine.getMultiPv).toBe('function')
    engine.destroy()
  })

  it('should throw if setSkillLevel is called before init', () => {
    const engine = new StockfishEngine()
    expect(() => engine.setSkillLevel(10)).toThrow('Stockfish not initialized')
    engine.destroy()
  })

  it('should throw if getMultiPv is called before init', async () => {
    const engine = new StockfishEngine()
    await expect(
      engine.getMultiPv('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).rejects.toThrow('Stockfish not initialized')
    engine.destroy()
  })

  it('should throw if getEvaluation is called before init', async () => {
    const engine = new StockfishEngine()
    await expect(
      engine.getEvaluation('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
    ).rejects.toThrow('Stockfish not initialized')
    engine.destroy()
  })
})

/**
 * Integration tests for Stockfish WASM run via Playwright (browser environment)
 * — see tests/e2e/stockfish.spec.ts. WASM + Web Workers are not available
 * in the jsdom/Node environment used by Vitest, so the real engine
 * load + best-move test is a Playwright e2e test.
 */

/**
 * Helper: create a StockfishEngine with a fake worker that emits scripted
 * UCI lines. This lets us test the parsing/resolution logic without a real
 * Web Worker or WASM.
 *
 * The fake worker is injected by replacing `this.worker` and intercepting
 * `postMessage` so we can respond with our scripted lines.
 */
function createEngineWithFakeWorker(scriptedLines: string[]): StockfishEngine {
  const engine = new StockfishEngine()
  // Access the private handleMessage via a typed cast that satisfies eslint
  type EngineInternals = { handleMessage: (line: string) => void }
  const internals = engine as unknown as EngineInternals
  // @ts-expect-error: inject a fake worker for testing
  engine.worker = {
    postMessage(msg: string) {
      // Respond to uci/isready immediately, otherwise emit scripted lines
      if (msg === 'uci') {
        setTimeout(() => internals.handleMessage('uciok'), 0)
      } else if (msg === 'isready') {
        setTimeout(() => internals.handleMessage('readyok'), 0)
      } else if (msg.startsWith('go ') || msg.startsWith('position') || msg.startsWith('ucinewgame') || msg.startsWith('setoption')) {
        // Emit the scripted lines for search-related commands
        for (const line of scriptedLines) {
          setTimeout(() => internals.handleMessage(line), 0)
        }
      }
    },
    terminate() {},
  }
  // Mark as ready so init() doesn't try to create a real worker
  // @ts-expect-error: ready is private
  engine.ready = Promise.resolve()
  return engine
}

describe('StockfishEngine — checkmate edge case (score mate 0, no bestmove)', () => {
  it('getEvaluation resolves on score mate 0 without waiting for bestmove', async () => {
    // Fool's mate position: Stockfish emits only 'info depth 0 score mate 0'
    // and never sends a bestmove line.
    const engine = createEngineWithFakeWorker(['info depth 0 score mate 0'])
    const result = await engine.getEvaluation(
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      8,
    )
    expect(result.mate).toBe(0)
    expect(result.bestMove).toBe('(none)')
    expect(result.depth).toBe(0)
    engine.destroy()
  })

  it('getEvaluation does not hang — resolves within 1 second on mate 0', async () => {
    const engine = createEngineWithFakeWorker(['info depth 0 score mate 0'])
    const start = Date.now()
    const result = await engine.getEvaluation(
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      8,
    )
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(1000) // Should resolve near-instantly, not hang
    expect(result.mate).toBe(0)
    engine.destroy()
  })

  it('getBestMove resolves on score mate 0 with bestMove (none)', async () => {
    const engine = createEngineWithFakeWorker(['info depth 0 score mate 0'])
    const result = await engine.getBestMove(
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      8,
    )
    expect(result.bestMove).toBe('(none)')
    expect(result.mate).toBe(0)
    engine.destroy()
  })

  it('getMultiPv resolves on score mate 0 with empty PV', async () => {
    const engine = createEngineWithFakeWorker(['info depth 0 score mate 0'])
    const result = await engine.getMultiPv(
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
      8,
      2,
    )
    expect(result.length).toBe(1)
    expect(result[0].mate).toBe(0)
    expect(result[0].pv).toEqual([])
    engine.destroy()
  })

  it('getEvaluation safety timeout: resolves after 10s if no bestmove and no mate 0', async () => {
    vi.useFakeTimers()
    // Engine that emits nothing (simulates a stuck worker)
    const engine = createEngineWithFakeWorker([])
    const promise = engine.getEvaluation(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      6,
    )
    // Fast-forward past the 10s safety timeout
    vi.advanceTimersByTime(10_500)
    const result = await promise
    expect(result.bestMove).toBe('(none)')
    vi.useRealTimers()
    engine.destroy()
  })
})
