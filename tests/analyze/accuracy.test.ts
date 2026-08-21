import { describe, it, expect } from 'vitest'
import { accuracyForSide, accuracyForGame } from '../../src/analyze/accuracy'
import type { GameAnalysis, AnalyzedMove } from '../../src/analyze/engine'
import type { Color, EvalScore, MoveInfo, MoveClassification } from '../../src/chess/types'

/** Build a minimal AnalyzedMove for testing. */
function am(
  ply: number,
  color: Color,
  evalBefore: EvalScore,
  evalAfter: EvalScore,
): AnalyzedMove {
  const move = {
    uci: 'e2e4',
    san: 'e4',
    from: 'e2',
    to: 'e4',
    color,
    piece: 'pawn' as const,
    flags: '',
    fenBefore: '',
    fenAfter: '',
  } as unknown as MoveInfo
  return {
    ply,
    move,
    evalBefore,
    evalAfter,
    bestEval: evalBefore,
    classification: 'no_annotation' as MoveClassification,
    color,
  }
}

describe('accuracyForSide', () => {
  it('returns null when the side made no moves', () => {
    const analysis: GameAnalysis = { moves: [], openingName: null }
    expect(accuracyForSide(analysis, 'white')).toBeNull()
  })

  it('returns ~100 when no moves lost eval (perfect play)', () => {
    const analysis: GameAnalysis = {
      moves: [
        am(0, 'white', { cp: 30 }, { cp: 30 }),
        am(1, 'white', { cp: 30 }, { cp: 30 }),
      ],
      openingName: null,
    }
    const acc = accuracyForSide(analysis, 'white')
    expect(acc).not.toBeNull()
    expect(acc!).toBeGreaterThan(95)
  })

  it('returns lower accuracy when moves blunder eval', () => {
    const analysis: GameAnalysis = {
      moves: [
        am(0, 'white', { cp: 300 }, { cp: -300 }), // big blunder
        am(1, 'white', { cp: 300 }, { cp: -300 }), // big blunder
      ],
      openingName: null,
    }
    const acc = accuracyForSide(analysis, 'white')
    expect(acc).not.toBeNull()
    expect(acc!).toBeLessThan(70)
  })

  it('computes per-side independently', () => {
    const analysis: GameAnalysis = {
      moves: [
        am(0, 'white', { cp: 0 }, { cp: 0 }), // white perfect
        am(1, 'black', { cp: 0 }, { cp: 500 }), // black blunders (white POV +500 = black is losing)
      ],
      openingName: null,
    }
    const whiteAcc = accuracyForSide(analysis, 'white')!
    const blackAcc = accuracyForSide(analysis, 'black')!
    expect(whiteAcc).toBeGreaterThan(blackAcc)
  })

  it('handles mate scores', () => {
    const analysis: GameAnalysis = {
      moves: [am(0, 'white', { mate: 5 }, { mate: 3 })],
      openingName: null,
    }
    const acc = accuracyForSide(analysis, 'white')
    expect(acc).not.toBeNull()
    expect(acc!).toBeGreaterThan(90) // mate progressed, near-perfect
  })
})

describe('accuracyForGame', () => {
  it('returns both sides', () => {
    const analysis: GameAnalysis = {
      moves: [
        am(0, 'white', { cp: 0 }, { cp: 0 }),
        am(1, 'black', { cp: 0 }, { cp: 0 }),
      ],
      openingName: null,
    }
    const result = accuracyForGame(analysis)
    expect(result.white).not.toBeNull()
    expect(result.black).not.toBeNull()
  })
})
