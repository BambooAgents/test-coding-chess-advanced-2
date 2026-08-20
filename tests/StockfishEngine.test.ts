import { describe, it, expect } from 'vitest'
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
