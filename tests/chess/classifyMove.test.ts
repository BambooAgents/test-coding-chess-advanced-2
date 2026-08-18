/**
 * Tests for classifyMove — the 6 eval-delta badges.
 *
 * Per docs/spec/annotation-thresholds.md §5 (decision tree) and §7 (test positions).
 */

import { describe, it, expect } from 'vitest'
import { classifyMove } from '../../src/chess/classifyMove'
import type { ClassifyMoveInput } from '../../src/chess/types'

/** Helper to construct a ClassifyMoveInput with sensible defaults. */
function makeInput(overrides: Partial<ClassifyMoveInput>): ClassifyMoveInput {
  return {
    color: 'white',
    evalBefore: { cp: 0 },
    evalAfter: { cp: 0 },
    bestEval: { cp: 0 },
    isCheckmate: false,
    legalMoveCount: 30,
    ply: 25,
    isOpening: false,
    isBestMove: false,
    ...overrides,
  }
}

describe('classifyMove — special cases (steps 1-3)', () => {
  it('returns best for checkmate', () => {
    const result = classifyMove(makeInput({ isCheckmate: true }))
    expect(result).toBe('best')
  })

  it('returns best for forced move (only one legal move)', () => {
    const result = classifyMove(makeInput({ legalMoveCount: 1 }))
    expect(result).toBe('best')
  })

  it('returns no_annotation in garbage time (|bestEval| > 700cp)', () => {
    const result = classifyMove(makeInput({ bestEval: { cp: 800 } }))
    expect(result).toBe('no_annotation')
  })

  it('returns no_annotation in garbage time (very negative)', () => {
    const result = classifyMove(makeInput({ bestEval: { cp: -800 } }))
    expect(result).toBe('no_annotation')
  })
})

describe('classifyMove — negative classifications (steps 6-8)', () => {
  it('classifies as blunder when delta ≤ -0.30', () => {
    // White moves, position goes from 0 to -700cp → delta ≈ -0.48 → blunder
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { cp: 0 },
        evalAfter: { cp: -700 },
        bestEval: { cp: 0 },
      }),
    )
    expect(result).toBe('blunder')
  })

  it('classifies fool\'s mate pattern (g4 blunder) as blunder', () => {
    // After 1.f3 e5 2.g4, white's g4 allows ...Qh4#
    // Eval before g4 ≈ 0, after g4 it's mate-in-1 for black
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { cp: 0 },
        evalAfter: { mate: -1 }, // black mates in 1
        bestEval: { cp: 0 },
      }),
    )
    expect(result).toBe('blunder')
  })

  it('classifies as mistake when delta is -0.20 to -0.30', () => {
    // White moves, position goes from cp=0 to cp=-300.
    // povDiff = (povChances(after) - povChances(before)) / 2 = (WC(-300) - WC(0)) / 2 ≈ -0.25 → MISTAKE.
    // (povDiff is inverted from lichess's raw formula so negative delta = worse, per spec §5.)
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { cp: 0 },
        evalAfter: { cp: -300 },
        bestEval: { cp: 0 },
      }),
    )
    expect(result).toBe('mistake')
  })

  it('classifies as inaccuracy when delta is -0.10 to -0.20', () => {
    // delta ≈ -0.12
    // before = 0 (WC=0), after needs WC ≈ -0.24 → cp ≈ -130
    // WC(-130) = 2/(1+exp(0.00368208*130)) - 1 = 2/(1+exp(0.479)) - 1
    // = 2/(1+1.614) - 1 = 2/2.614 - 1 = 0.765 - 1 = -0.235
    // delta = (-0.235 - 0)/2 = -0.118 → INACCURACY
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { cp: 0 },
        evalAfter: { cp: -130 },
        bestEval: { cp: 0 },
      }),
    )
    expect(result).toBe('inaccuracy')
  })
})

describe('classifyMove — positive classifications (steps 10-15)', () => {
  it('classifies as book in opening with small eval loss', () => {
    const result = classifyMove(
      makeInput({
        color: 'white',
        ply: 3,
        isOpening: true,
        evalBefore: { cp: 20 },
        evalAfter: { cp: 10 },
        bestEval: { cp: 20 },
        isBestMove: false,
      }),
    )
    expect(result).toBe('book')
  })

  it('classifies as best when move matches engine #1', () => {
    const result = classifyMove(
      makeInput({
        color: 'white',
        isBestMove: true,
        evalBefore: { cp: 50 },
        evalAfter: { cp: 50 },
        bestEval: { cp: 50 },
        ply: 25,
        isOpening: false,
      }),
    )
    expect(result).toBe('best')
  })

  it('classifies as great when best move after opponent blunder (not opening)', () => {
    const result = classifyMove(
      makeInput({
        color: 'white',
        isBestMove: true,
        evalBefore: { cp: 200 },
        evalAfter: { cp: 200 },
        bestEval: { cp: 200 },
        ply: 25,
        isOpening: false,
        prevOppClassification: 'blunder',
      }),
    )
    expect(result).toBe('great')
  })

  it('classifies as great when best move after own previous great (not opening)', () => {
    const result = classifyMove(
      makeInput({
        color: 'white',
        isBestMove: true,
        evalBefore: { cp: 200 },
        evalAfter: { cp: 200 },
        bestEval: { cp: 200 },
        ply: 25,
        isOpening: false,
        prevOwnClassification: 'great',
      }),
    )
    expect(result).toBe('great')
  })

  it('does NOT classify as great in opening phase', () => {
    // In the opening, even with isBestMove and prevOpp=blunder, should NOT be great.
    // Book fires first if winLoss <= 2.0 and cpLoss <= 20.
    // With isBestMove and evalAfter == bestEval, cpLoss = 0, winLoss = 0 → book.
    // To avoid book, set isOpening: false at the test level but verify great doesn't fire.
    // Instead, test that in the opening with isBestMove, result is 'best' or 'book', not 'great'.
    const result = classifyMove(
      makeInput({
        color: 'white',
        isBestMove: true,
        evalBefore: { cp: 50 },
        evalAfter: { cp: 50 },
        bestEval: { cp: 50 },
        ply: 5,
        isOpening: true,
        prevOppClassification: 'blunder',
      }),
    )
    // Book fires (winLoss=0, cpLoss=0, isOpening=true) → 'book'.
    // Great does NOT fire because we're in opening. Correct per spec.
    expect(result).not.toBe('great')
    expect(['book', 'best']).toContain(result)
  })

  it('classifies as good when win-prob loss is 2.5-8%', () => {
    // Need winLossPct between 2.5 and 8
    // bestEval ≈ +100 (winPct ≈ 65), playedEval ≈ +50 (winPct ≈ 59)
    // winLossPct = 65 - 59 = 6 → GOOD
    // But we also need delta > -0.10 (inaccuracy threshold)
    // delta = (WC(after) - WC(before))/2 = (WC(50) - WC(100))/2
    // WC(50) ≈ 0.157, WC(100) ≈ 0.31
    // delta = (0.157 - 0.31)/2 = -0.077 → > -0.10 → OK (not negative classification)
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { cp: 100 },
        evalAfter: { cp: 50 },
        bestEval: { cp: 100 },
        ply: 25,
        isOpening: false,
        isBestMove: false,
      }),
    )
    expect(result).toBe('good')
  })

  it('classifies as best when win-prob loss ≤ 2.5% (not isBestMove)', () => {
    // bestEval ≈ +100 (winPct ≈ 65), playedEval ≈ +90 (winPct ≈ 63.5)
    // winLossPct = 65 - 63.5 = 1.5 → BEST
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { cp: 100 },
        evalAfter: { cp: 90 },
        bestEval: { cp: 100 },
        ply: 25,
        isOpening: false,
        isBestMove: false,
      }),
    )
    expect(result).toBe('best')
  })
})

describe('classifyMove — mate sequences (step 5)', () => {
  it('classifies mate_created as best', () => {
    // Before: cp=100, After: mate=3 (white mates)
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { cp: 100 },
        evalAfter: { mate: 3 },
        bestEval: { cp: 100 },
      }),
    )
    expect(result).toBe('best')
  })

  it('classifies mate_lost as mistake or blunder', () => {
    // Before: mate=3 (white mating), After: cp=0 (lost the mate sequence)
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { mate: 3 },
        evalAfter: { cp: 0 },
        bestEval: { mate: 3 },
      }),
    )
    // Should be at least inaccuracy (lost forced mate)
    expect(['inaccuracy', 'mistake', 'blunder']).toContain(result)
  })

  it('classifies mate_created for black as best', () => {
    // Black moves, before: cp=-100 (slightly good for white), after: mate=-3 (black mates)
    // mate < 0 = Black mates → good for black mover
    const result = classifyMove(
      makeInput({
        color: 'black',
        evalBefore: { cp: -100 },
        evalAfter: { mate: -3 },
        bestEval: { cp: -100 },
      }),
    )
    expect(result).toBe('best')
  })

  it('classifies mate_lost for black as negative', () => {
    // Black had mate=-3 (black mating), after: cp=0 (lost the mate)
    const result = classifyMove(
      makeInput({
        color: 'black',
        evalBefore: { mate: -3 },
        evalAfter: { cp: 0 },
        bestEval: { mate: -3 },
      }),
    )
    expect(['inaccuracy', 'mistake', 'blunder']).toContain(result)
  })

  it('classifies mate_delayed for black as inaccuracy', () => {
    // Black had mate=-3, now mate=-6 (slower mate = worse)
    // |mateAfter| > |mateBefore| → delayed → inaccuracy if increase > 2
    const result = classifyMove(
      makeInput({
        color: 'black',
        evalBefore: { mate: -3 },
        evalAfter: { mate: -6 },
        bestEval: { mate: -3 },
      }),
    )
    expect(result).toBe('inaccuracy')
  })

  it('classifies mate_delayed for white as inaccuracy', () => {
    // White had mate=3, now mate=6 (slower mate = worse)
    const result = classifyMove(
      makeInput({
        color: 'white',
        evalBefore: { mate: 3 },
        evalAfter: { mate: 6 },
        bestEval: { mate: 3 },
      }),
    )
    expect(result).toBe('inaccuracy')
  })
})

describe('classifyMove — black perspective', () => {
  it('classifies blunder for black correctly', () => {
    // Black moves, position (white POV) goes from 0 to +700 → bad for black
    const result = classifyMove(
      makeInput({
        color: 'black',
        evalBefore: { cp: 0 },
        evalAfter: { cp: 700 },
        bestEval: { cp: 0 },
      }),
    )
    expect(result).toBe('blunder')
  })

  it('classifies best for black correctly', () => {
    const result = classifyMove(
      makeInput({
        color: 'black',
        isBestMove: true,
        evalBefore: { cp: -50 },
        evalAfter: { cp: -50 },
        bestEval: { cp: -50 },
        ply: 25,
        isOpening: false,
      }),
    )
    expect(result).toBe('best')
  })
})
