import { describe, it, expect } from 'vitest'
import { createMockEngineAdapter, analyzeGameEvals } from '../src/weaknesses/engineAdapter'

describe('createMockEngineAdapter', () => {
  it('returns pre-set evals for matching FENs', async () => {
    const evalMap = new Map([
      ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { bestMove: 'e2e4', cp: 30, depth: 6 }],
    ])
    const engine = createMockEngineAdapter(evalMap)
    await engine.init()

    const result = await engine.getEval('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 6)
    expect(result.cp).toBe(30)
    expect(result.bestMove).toBe('e2e4')
  })

  it('returns neutral eval for unknown FEN', async () => {
    const engine = createMockEngineAdapter(new Map())
    await engine.init()
    const result = await engine.getEval('some-unknown-fen', 6)
    expect(result.cp).toBe(0)
  })

  it('matches on board position part only', async () => {
    const evalMap = new Map([
      ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', { bestMove: 'e2e4', cp: 50, depth: 6 }],
    ])
    const engine = createMockEngineAdapter(evalMap)
    await engine.init()

    const result = await engine.getEval('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 2 3', 6)
    expect(result.cp).toBe(50)
  })
})

describe('analyzeGameEvals', () => {
  it('produces per-ply evals for a game', async () => {
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const evalMap = new Map([
      [startingFen, { bestMove: 'e2e4', cp: 20, depth: 6 }],
      ['rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1', { bestMove: 'e7e5', cp: 30, depth: 6 }],
      ['rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2', { bestMove: 'g1f3', cp: 25, depth: 6 }],
    ])
    const engine = createMockEngineAdapter(evalMap)

    const evals = await analyzeGameEvals(startingFen, ['e2e4', 'e7e5'], engine, 6)
    expect(evals).toHaveLength(3)
    expect(evals[0].cp).toBe(20)
    expect(evals[1].cp).toBe(30)
    expect(evals[2].cp).toBe(25)
  })

  it('produces a single eval for a game with no moves', async () => {
    const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const evalMap = new Map([
      [startingFen, { bestMove: 'e2e4', cp: 20, depth: 6 }],
    ])
    const engine = createMockEngineAdapter(evalMap)

    const evals = await analyzeGameEvals(startingFen, [], engine, 6)
    expect(evals).toHaveLength(1)
    expect(evals[0].cp).toBe(20)
  })
})
