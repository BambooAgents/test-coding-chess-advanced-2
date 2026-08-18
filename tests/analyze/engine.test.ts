import { describe, it, expect } from 'vitest'
import { analyzeGame, type AnalyzeEngine, type GameAnalysis } from '../../src/analyze/engine'
import { parsePgn } from '../../src/chess/pgn'
import type { EvalScore } from '../../src/chess/types'

/** Build a mock engine from a list of evals (one per position, White's POV). */
function mockEngine(evals: EvalScore[]): AnalyzeEngine {
  let i = 0
  return {
    async evaluate(): Promise<EvalScore> {
      const e = evals[i % evals.length]
      i++
      return Promise.resolve({ ...e })
    },
  }
}

/** A short PGN: 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 (Ruy Lopez). */
const RUY_PGN = `[Event "Test"]
[White "A"]
[Black "B"]
[Result "*"]
[Opening "Ruy Lopez"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 *
`

describe('analyzeGame', () => {
  it('analyzes every move and returns classifications', async () => {
    const game = parsePgn(RUY_PGN)
    const engine = mockEngine([{ cp: 30 }])
    const analysis = await analyzeGame(game, engine)

    expect(analysis.moves.length).toBe(game.moves.length)
    for (const m of analysis.moves) {
      expect(typeof m.classification).toBe('string')
      expect(m.color).toMatch(/white|black/)
      expect(m.evalBefore).toBeDefined()
      expect(m.evalAfter).toBeDefined()
    }
  })

  it('calls onProgress after each move (progressive)', async () => {
    const game = parsePgn(RUY_PGN)
    const engine = mockEngine([{ cp: 30 }])
    const progressSnapshots: GameAnalysis[] = []

    await analyzeGame(game, engine, (partial) => progressSnapshots.push(partial))

    expect(progressSnapshots.length).toBe(game.moves.length)
    expect(progressSnapshots[0].moves.length).toBe(1)
    expect(progressSnapshots[progressSnapshots.length - 1].moves.length).toBe(game.moves.length)
  })

  it('extracts the opening name from PGN headers', async () => {
    const game = parsePgn(RUY_PGN)
    const engine = mockEngine([{ cp: 0 }])
    const analysis = await analyzeGame(game, engine)
    expect(analysis.openingName).toBe('Ruy Lopez')
  })

  it('returns null opening name when no Opening header', async () => {
    const pgn = `[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 e5 *\n`
    const game = parsePgn(pgn)
    const engine = mockEngine([{ cp: 0 }])
    const analysis = await analyzeGame(game, engine)
    expect(analysis.openingName).toBeNull()
  })

  it('classifies a large eval drop as a negative badge', async () => {
    const pgn = `[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 e5 *\n`
    const game = parsePgn(pgn)
    // White's e4: evalBefore +500, evalAfter -500 (a 1000cp drop, below the 700 garbage threshold).
    const engine = mockEngine([
      { cp: 500 },  // before e4 (White)
      { cp: -500 }, // after e4
      { cp: -500 }, // before e5 (Black)
      { cp: -500 }, // after e5
    ])
    const analysis = await analyzeGame(game, engine)
    const whiteMove = analysis.moves[0]
    expect(whiteMove.color).toBe('white')
    expect(['blunder', 'mistake', 'inaccuracy']).toContain(whiteMove.classification)
  })

  it('skips classification in garbage time (huge eval)', async () => {
    const pgn = `[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 e5 *\n`
    const game = parsePgn(pgn)
    const engine = mockEngine([{ cp: 1000 }])
    const analysis = await analyzeGame(game, engine)
    for (const m of analysis.moves) {
      expect(m.classification).toBe('no_annotation')
    }
  })

  it('handles mate scores without throwing', async () => {
    const pgn = `[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 e5 *\n`
    const game = parsePgn(pgn)
    const engine = mockEngine([{ mate: 3 }])
    const analysis = await analyzeGame(game, engine)
    expect(analysis.moves.length).toBe(2)
    for (const m of analysis.moves) {
      expect(typeof m.classification).toBe('string')
    }
  })

  it('progress snapshots are independent copies (mutation-safe)', async () => {
    const game = parsePgn(RUY_PGN)
    const engine = mockEngine([{ cp: 10 }])
    const snapshots: GameAnalysis[] = []
    await analyzeGame(game, engine, (p) => snapshots.push(p))

    snapshots[0].moves.push(snapshots[0].moves[0])
    expect(snapshots[snapshots.length - 1].moves.length).toBe(game.moves.length)
  })
})
