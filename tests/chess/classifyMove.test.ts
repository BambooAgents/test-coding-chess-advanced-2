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
    // Find cp values that give delta ≈ -0.25
    // winningChances(cp) = 2/(1+exp(-0.00368208*cp)) - 1
    // We need delta ≈ -0.25
    // delta = (povChances(color, before) - povChances(color, after)) / 2
    // For white: delta = (winningChances(before) - winningChances(after)) / 2
    // We want delta ≈ -0.25, so winningChances(after) - winningChances(before) ≈ 0.5
    // If before = 0 (WC=0), after needs WC ≈ -0.5, which is about cp ≈ -300
    // Let me check: winningChances(-300) = 2/(1+exp(0.00368208*300)) - 1
    // = 2/(1+exp(1.1046)) - 1 = 2/(1+3.018) - 1 = 2/4.018 - 1 = 0.498 - 1 = -0.502
    // delta = (0 - (-0.502))/2 = 0.502/2 = 0.251... wait that's positive for the mover?
    // No — delta = (povChances(before) - povChances(after))/2 = (0 - (-0.502))/2 = 0.251
    // That's positive, meaning the position improved? No, from white's POV, going from 0 to -300
    // means the position worsened. But the formula says delta = (WC(before) - WC(after))/2
    // = (0 - WC(-300))/2 = (0 - (-0.502))/2 = +0.251
    // That means delta is POSITIVE when the position gets worse for white?
    // No, wait: povChances returns from the MOVER's perspective.
    // White moves: povChances(white, before) = WC(before_cp), povChances(white, after) = WC(after_cp)
    // If white moves and position goes from cp=0 to cp=-300, WC goes from 0 to -0.502
    // delta = (WC(0) - WC(-300))/2 = (0 - (-0.502))/2 = 0.251
    // That's positive — but the position got WORSE for white!
    // The formula says delta = (povChances(before) - povChances(after))/2
    // If before is better (higher WC), then before - after > 0, meaning delta > 0
    // But the spec says "negative delta means the move worsened the player's position"
    // Wait, re-reading the spec:
    // "delta = povDiff(color, e1, e2) = (povChances(color, e1) - povChances(color, e2)) / 2"
    // "A negative delta means the move worsened the player's position"
    // So if e1 (before) is better than e2 (after), then e1 - e2 > 0, delta > 0
    // That means a GOOD move (position improved) has delta > 0 and a BAD move has delta < 0
    // Wait no: if the position WORSENED, e2 < e1, so e1 - e2 > 0, delta > 0
    // That contradicts "negative delta means worsened"!
    // Let me re-read: "delta = (povChances(color, e1) - povChances(color, e2)) / 2"
    // If position worsened: e2 < e1, so e1 - e2 > 0, delta > 0.
    // But spec says "A negative delta means the move worsened."
    // This seems contradictory. Let me check the lichess code.
    // lichess: povDiff = (povChances(color, e1) - povChances(color, e2)) / 2
    // If white plays a bad move: evalBefore (white POV) = +100, evalAfter (white POV) = -100
    // povChances(white, before) = WC(100) ≈ 0.31
    // povChances(white, after) = WC(-100) ≈ -0.31
    // delta = (0.31 - (-0.31))/2 = 0.62/2 = 0.31 — POSITIVE!
    // But the spec says delta ≤ -0.30 for blunder...
    // AH WAIT. I think the convention is that evalAfter is from the OPPONENT's perspective
    // after the move. No — re-reading: "e1 = eval before the move, e2 = eval after the move"
    // and "delta ranges from -1 (catastrophic loss) to +1 (brilliant gain)"
    // "A negative delta means the move worsened the player's position"
    // So for a blunder, delta should be negative.
    // Let me check: maybe the formula is the other way: (e2 - e1) instead of (e1 - e2)?
    // From the lichess code: povDiff(c, e1, e2) = (povChances(c, e1) - povChances(c, e2)) / 2
    // For a blunder (position worsened): e1 > e2, so e1 - e2 > 0, delta > 0
    // That doesn't match "negative = worse".
    // Unless... the evalAfter is from the opponent's POV (because it's the opponent's turn)?
    // In lichess, after a move, the eval is from the NEXT player to move (the opponent).
    // So if white plays a blunder, the eval after is from black's perspective = good for black
    // = positive cp for black = NEGATIVE cp for white.
    // So evalAfter is ALWAYS from the opponent's perspective? No, that doesn't make sense either.
    // Actually, in lichess, evals are always from White's perspective.
    // The trick is in the "player's perspective" conversion.
    // Let me think again: 
    // Before white's move: eval is from white's perspective (white to move).
    // After white's move: eval is from white's perspective (black to move).
    // If white plays a blunder, evalBefore = +100 (white POV), evalAfter = -100 (white POV).
    // povChances(white, before) = WC(100) ≈ +0.31
    // povChances(white, after) = WC(-100) ≈ -0.31
    // delta = (0.31 - (-0.31))/2 = 0.31 → POSITIVE
    // But spec says negative = worse. So maybe I have the formula backwards.
    // OR maybe the formula in the spec is correct but the delta interpretation is different.
    // Let me look at lichess Advice.scala more carefully.
    // In lichess, the advice compares the BEST move's eval to the PLAYED move's eval.
    // The "delta" in lichess is: bestMoveEval - playedMoveEval (from mover's perspective)
    // If the played move is worse than best, delta = best - played > 0 (positive)
    // And then lichess checks: if (d <= delta) where delta is NEGATIVE (-0.3, -0.2, -0.1)
    // Wait — in lichess, the check is: d <= delta where d is the centipawn/mate difference
    // and delta is the threshold (e.g. -0.3 for blunder).
    // Actually, re-reading the spec more carefully:
    // "delta = povDiff(color, e1, e2) = (povChances(color, e1) - povChances(color, e2)) / 2"
    // "A negative delta means the move worsened the player's position"
    // For a blunder: position went from good to bad.
    // povChances(white, before) = high, povChances(white, after) = low
    // delta = (high - low) / 2 = positive
    // That contradicts! Unless the convention is that e2 (after) is actually
    // the eval AFTER the opponent's best response, not just after the player's move.
    // Or unless I'm reading the formula wrong.
    // 
    // OK, let me just look at what makes the tests pass. The spec says:
    // "if delta <= -0.30: return BLUNDER"
    // For a blunder to give delta <= -0.30, we need delta negative.
    // delta = (povChances(before) - povChances(after)) / 2
    // For delta to be negative: povChances(before) < povChances(after)
    // That means the position IMPROVED for the mover (after > before).
    // That can't be right for a blunder.
    // 
    // I think the issue is that the formula should be:
    // delta = (povChances(after) - povChances(before)) / 2
    // i.e. (e2 - e1), not (e1 - e2).
    // Then for a blunder: after < before → delta < 0 → correct.
    // 
    // BUT the spec explicitly says: "delta = povDiff(color, e1, e2) = (povChances(color, e1) - povChances(color, e2)) / 2"
    // And "A negative delta means the move worsened."
    // 
    // The only way both can be true is if e2 > e1 when the position worsens.
    // That would be the case if e2 is from the OPPONENT's perspective.
    // i.e., after white plays a blunder, the eval from black's perspective is good
    // (high for black), so povChances(black, after) would be high.
    // But the function takes color = white (the mover), and computes povChances(white, after).
    //
    // Hmm, I think there might be an error in the spec, or the convention is
    // that evalAfter is the eval from the position AFTER the move, which is
    // from the opponent's perspective (opponent to move).
    // In engine analysis, after white plays, the engine evaluates from black's
    // perspective, so a good position for black (bad for white) has a high eval.
    // If we then convert with povChances(white, evalAfter) and evalAfter is
    // from black's perspective... no, that doesn't make sense either.
    //
    // Actually, I think the key insight is: in lichess, the evals are ALWAYS
    // from white's perspective. The "player's perspective" conversion via
    // povChances handles the color.
    // For a white blunder: evalBefore (white POV) = +100, evalAfter (white POV) = -100
    // But the OPPONENT is the one who benefits. The "delta" from the player's
    // perspective should be negative.
    // povChances(white, before) = WC(+100) ≈ +0.31
    // povChances(white, after) = WC(-100) ≈ -0.31
    // delta = (before - after)/2 = (0.31 - (-0.31))/2 = 0.31 → positive!
    //
    // This is DEFINITELY positive, which means the formula as written gives
    // a positive delta for a blunder, contradicting the spec.
    //
    // CONCLUSION: The formula should be (after - before), not (before - after).
    // OR the spec means something different by "e1" and "e2".
    // 
    // Let me just make the implementation match the spec's INTENT (negative = worse)
    // and the threshold checks (delta <= -0.30 = blunder).
    // The correct formula for "how much did the move worsen the position" is:
    // delta = povChances(after) - povChances(before)  [mover's perspective]
    // If the move worsened: after < before → delta < 0 → correct.
    // The spec's formula (before - after) gives the opposite sign.
    //
    // I'll use the correct sign (after - before) to match the spec's thresholds.
    
    // For a mistake: delta ≈ -0.25
    // We need povChances(white, after) - povChances(white, before) ≈ -0.25
    // before = 0 → WC(0) = 0
    // after needs WC(after) ≈ -0.5 → cp ≈ -300
    // Let's verify: WC(-300) ≈ -0.50
    // delta = (-0.50 - 0)/2... wait, the /2 is in the formula.
    // Actually the formula divides by 2. Let me reconsider.
    // If delta = (povChances(after) - povChances(before)) / 2
    // and before=0 (WC=0), after=-300 (WC≈-0.50):
    // delta = (-0.50 - 0) / 2 = -0.25 → MISTAKE. Correct!
    
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
