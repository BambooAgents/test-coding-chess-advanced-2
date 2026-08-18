/**
 * Tests for winning-chances math — verifies the lichess formula
 * per docs/spec/annotation-thresholds.md §1.
 */

import { describe, it, expect } from 'vitest'
import {
  winningChances,
  mateWinningChances,
  evalWinningChances,
  povChances,
  povDiff,
  winPercent,
  evalToWinPercent,
  povWinPercent,
  accuracyFromWinPercents,
} from '../../src/chess/winningChances'
import type { EvalScore } from '../../src/chess/types'

describe('winningChances', () => {
  it('returns 0 for 0 centipawns (equal position)', () => {
    expect(winningChances(0)).toBeCloseTo(0, 5)
  })

  it('returns positive for positive cp (white winning)', () => {
    expect(winningChances(100)).toBeGreaterThan(0)
  })

  it('returns negative for negative cp (black winning)', () => {
    expect(winningChances(-100)).toBeLessThan(0)
  })

  it('returns +1 for very high cp (clamped)', () => {
    expect(winningChances(1000)).toBeCloseTo(1, 1)
    expect(winningChances(5000)).toBeCloseTo(1, 1) // clamped
  })

  it('returns -1 for very low cp (clamped)', () => {
    expect(winningChances(-1000)).toBeCloseTo(-1, 1)
    expect(winningChances(-5000)).toBeCloseTo(-1, 1) // clamped
  })

  it('is symmetric: winningChances(cp) === -winningChances(-cp)', () => {
    for (const cp of [50, 100, 200, 300, 500]) {
      expect(winningChances(cp)).toBeCloseTo(-winningChances(-cp), 5)
    }
  })
})

describe('mateWinningChances', () => {
  it('returns close to +1 for mate in 1 (white)', () => {
    expect(mateWinningChances(1)).toBeGreaterThan(0.95)
  })

  it('returns close to -1 for mate in 1 (black)', () => {
    expect(mateWinningChances(-1)).toBeLessThan(-0.95)
  })

  it('returns close to +1 for any mate value (all clamp to max)', () => {
    expect(mateWinningChances(1)).toBeCloseTo(1, 1)
    expect(mateWinningChances(5)).toBeCloseTo(1, 1)
    expect(mateWinningChances(10)).toBeCloseTo(1, 1)
  })
})

describe('evalWinningChances', () => {
  it('handles cp scores', () => {
    const ev: EvalScore = { cp: 100 }
    expect(evalWinningChances(ev)).toBeCloseTo(winningChances(100), 5)
  })

  it('handles mate scores', () => {
    const ev: EvalScore = { mate: 3 }
    expect(evalWinningChances(ev)).toBeCloseTo(mateWinningChances(3), 5)
  })

  it('returns 0 for unknown eval', () => {
    const ev: EvalScore = {}
    expect(evalWinningChances(ev)).toBe(0)
  })
})

describe('povChances', () => {
  it('returns winningChances as-is for white', () => {
    const ev: EvalScore = { cp: 100 }
    expect(povChances('white', ev)).toBeCloseTo(winningChances(100), 5)
  })

  it('negates winningChances for black', () => {
    const ev: EvalScore = { cp: 100 }
    expect(povChances('black', ev)).toBeCloseTo(-winningChances(100), 5)
  })
})

describe('povDiff', () => {
  it('returns positive delta when position improves for the mover', () => {
    // White moves, position goes from 0 to +100 → delta should be positive
    const before: EvalScore = { cp: 0 }
    const after: EvalScore = { cp: 100 }
    const delta = povDiff('white', before, after)
    expect(delta).toBeGreaterThan(0)
  })

  it('returns negative delta when position worsens for the mover', () => {
    // White moves, position goes from +100 to -100 → delta should be negative
    const before: EvalScore = { cp: 100 }
    const after: EvalScore = { cp: -100 }
    const delta = povDiff('white', before, after)
    expect(delta).toBeLessThan(0)
  })

  it('handles black perspective correctly', () => {
    // Black moves, position (white POV) goes from 0 to -100 → good for black
    const before: EvalScore = { cp: 0 }
    const after: EvalScore = { cp: -100 }
    const delta = povDiff('black', before, after)
    expect(delta).toBeGreaterThan(0) // black's position improved
  })

  it('blunder-level delta (≈ -0.30 or worse)', () => {
    // Position goes from 0 to about -700cp → delta should be ≤ -0.30
    const before: EvalScore = { cp: 0 }
    const after: EvalScore = { cp: -700 }
    const delta = povDiff('white', before, after)
    expect(delta).toBeLessThanOrEqual(-0.30)
  })
})

describe('winPercent', () => {
  it('returns 50 for 0 cp', () => {
    expect(winPercent(0)).toBeCloseTo(50, 1)
  })

  it('returns > 50 for positive cp', () => {
    expect(winPercent(100)).toBeGreaterThan(50)
  })

  it('returns < 50 for negative cp', () => {
    expect(winPercent(-100)).toBeLessThan(50)
  })

  it('returns close to 100 for very high cp', () => {
    // The sigmoid asymptotes at 100 but never reaches it; 97.5 is the max at cp=1000
    expect(winPercent(1000)).toBeGreaterThan(95)
  })

  it('returns close to 0 for very low cp', () => {
    // The sigmoid asymptotes at 0 but never reaches it; 2.5 is the min at cp=-1000
    expect(winPercent(-1000)).toBeLessThan(5)
  })
})

describe('evalToWinPercent', () => {
  it('handles cp scores', () => {
    expect(evalToWinPercent({ cp: 0 })).toBeCloseTo(50, 1)
    expect(evalToWinPercent({ cp: 100 })).toBeGreaterThan(50)
  })

  it('handles mate scores', () => {
    expect(evalToWinPercent({ mate: 1 })).toBeGreaterThan(95)
    expect(evalToWinPercent({ mate: -1 })).toBeLessThan(5)
  })
})

describe('povWinPercent', () => {
  it('returns win% from white perspective', () => {
    expect(povWinPercent('white', { cp: 100 })).toBeGreaterThan(50)
  })

  it('returns win% from black perspective', () => {
    expect(povWinPercent('black', { cp: 100 })).toBeLessThan(50)
  })
})

describe('accuracyFromWinPercents', () => {
  it('returns 100 when after >= before', () => {
    expect(accuracyFromWinPercents(50, 50)).toBe(100)
    expect(accuracyFromWinPercents(50, 60)).toBe(100)
  })

  it('returns < 100 when after < before', () => {
    expect(accuracyFromWinPercents(80, 50)).toBeLessThan(100)
  })

  it('returns higher accuracy for smaller drops', () => {
    const small = accuracyFromWinPercents(55, 50)
    const large = accuracyFromWinPercents(80, 50)
    expect(small).toBeGreaterThan(large)
  })

  it('never returns negative', () => {
    expect(accuracyFromWinPercents(100, 0)).toBeGreaterThanOrEqual(0)
  })
})
