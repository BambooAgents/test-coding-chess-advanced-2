import { describe, it, expect } from 'vitest'
import { isBrilliant, BRILLIANT_THRESHOLDS, type BrilliantEngine } from '../../src/chess/brilliant'
import type { EvalScore } from '../../src/chess/types'

/** A fully controllable mock engine. */
function mockEngine(opts: {
  bestMove?: string
  pv1?: EvalScore
  pv2?: EvalScore
  evalAfterCapture?: EvalScore
  evalAfterMove?: EvalScore
}): BrilliantEngine {
  return {
    async bestMove(): Promise<string> { return opts.bestMove ?? 'e2e4' },
    async multiPv2(): Promise<{ pv1: EvalScore; pv2: EvalScore }> {
      return { pv1: opts.pv1 ?? { cp: 100 }, pv2: opts.pv2 ?? { cp: 50 } }
    },
    async evaluate(): Promise<EvalScore> {
      return opts.evalAfterCapture ?? opts.evalAfterMove ?? { cp: 0 }
    },
  }
}

describe('isBrilliant', () => {
  it('returns false when the move is not the engine best move (Rule 1)', async () => {
    // Position where a knight hangs on d5, white to move (white is the mover).
    // After white's move it's black's turn; the knight on d5 is white's and hangs.
    const fenBefore = '4k3/8/8/3N4/8/8/8/4K3 w - - 0 1' // white knight d5, white to move
    const fenAfter = '4k3/8/8/3N4/8/8/8/4K3 b - - 0 1' // same but black to move (null-ish; knight hangs)
    const result = await isBrilliant(
      {
        fenBefore,
        playedUci: 'a1a3', // some non-best move
        playedSan: 'a3',
        mover: 'white',
        fenAfter,
        evalAfterMove: { cp: 100 },
        movedCapturedValue: 0,
      },
      mockEngine({ bestMove: 'e2e4' }),
    )
    expect(result).toBe(false)
  })

  it('returns false when the move delivers checkmate (Rule 5: Best, not Brilliant)', async () => {
    // Scholar's mate position: white plays Qxf7#.
    const fenBefore = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 4 4'
    const fenAfter = 'r1bqkbnr/pppp1Qpp/2n5/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'
    const result = await isBrilliant(
      {
        fenBefore,
        playedUci: 'd5f7',
        playedSan: 'Qxf7#',
        mover: 'white',
        fenAfter,
        evalAfterMove: { mate: 0 },
        movedCapturedValue: 1, // captured a pawn
      },
      mockEngine({ bestMove: 'd5f7', evalAfterCapture: { mate: 0 } }),
    )
    expect(result).toBe(false)
  })

  it('returns false when the position is already lost after the move (Rule 3)', async () => {
    // White is down a queen after the move (win% < 40).
    const fenBefore = '4k3/8/8/3N4/8/8/8/4K3 w - - 0 1'
    const result = await isBrilliant({ fenBefore, playedUci: "d5b4", playedSan: "Nb4", mover: "white", fenAfter: "4k3/8/8/3N4/8/8/8/4K3 b - - 0 1", evalAfterMove: { cp: -800 }, movedCapturedValue: 0 }, mockEngine({ bestMove: "d5b4" })); expect(result).toBe(false) })

  it('returns false when there is no hanging-piece bait (Rule 2)', async () => {
    // Starting position — nothing hangs.
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    const fenAfter = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' // after e4
    const result = await isBrilliant(
      {
        fenBefore,
        playedUci: 'e2e4',
        playedSan: 'e4',
        mover: 'white',
        fenAfter,
        evalAfterMove: { cp: 20 },
        movedCapturedValue: 0,
      },
      mockEngine({ bestMove: 'e2e4' }),
    )
    expect(result).toBe(false)
  })

  it('returns true for a self-sacrifice only-move (Mechanism B, self-sacrifice)', async () => {
    // White knight on d5 hangs (black to move can capture). The move matches
    // engine best, eval after is good (win% >= 40), and the move is an only
    // move (pv1 >> pv2). Self-sacrifice: bait square == move target.
    const fenBefore = '4k3/8/8/3N4/8/8/8/4K3 w - - 0 1'
    // After Nf6 (knight to f6 and hangs): black queen on f7 can capture Qxf6.
    const fen = '4k3/5q2/5N2/8/8/8/8/4K3 b - - 0 1'
    const result = await isBrilliant(
      {
        fenBefore,
        playedUci: 'd5f6',
        playedSan: 'Nf6',
        mover: 'white',
        fenAfter: fen,
        evalAfterMove: { cp: 200 }, // white still better
        movedCapturedValue: 0,
      },
      mockEngine({
        bestMove: 'd5f6',
        pv1: { cp: 200 },
        pv2: { cp: -100 }, // big only-move margin (300cp)
        evalAfterCapture: { cp: -200 }, // after Qxf6, white is worse (poison)
      }),
    )
    // Self-sacrifice (f6 == move target) + only move → should be brilliant.
    expect(result).toBe(true)
  })

  it('returns true for a poisoned bait (Mechanism A)', async () => {
    // White plays a move that hangs a piece, but capturing it is poisoned:
    // the taker's eval drops by >= 300cp.
    const fenBefore = '4k3/8/8/3N4/8/8/8/4K3 w - - 0 1'
    // Knight hangs on d5 after a bystander move (a3, not to d5). Black queen on e5 can take d5.
    const fenAfterWithQ = '4k3/8/8/3Nq3/8/8/P7/4K3 b - - 0 1'
    const result = await isBrilliant(
      {
        fenBefore,
        playedUci: 'a2a3', // bystander move (not to d5)
        playedSan: 'a3',
        mover: 'white',
        fenAfter: fenAfterWithQ,
        evalAfterMove: { cp: 150 }, // white better before capture
        movedCapturedValue: 0,
      },
      mockEngine({
        bestMove: 'a2a3',
        pv1: { cp: 150 },
        pv2: { cp: -100 }, // only-move margin 250
        // After Qxd5, white is much worse (poison): taker (black) loses.
        evalAfterCapture: { cp: 500 }, // white POV +500 → black is losing after taking
      }),
    )
    // Mechanism A: takerLoss = takerSign*evalAfterMove - takerSign*evalAfterCapture
    // = (-1*150) - (-1*500) = -150 + 500 = 350 >= 300 → poisoned → brilliant.
    expect(result).toBe(true)
  })
})

describe('BRILLIANT_THRESHOLDS', () => {
  it('has the calibrated defaults', () => {
    expect(BRILLIANT_THRESHOLDS.seeThreshold).toBe(1)
    expect(BRILLIANT_THRESHOLDS.netSacMin).toBe(1)
    expect(BRILLIANT_THRESHOLDS.poisonLossCp).toBe(300)
    expect(BRILLIANT_THRESHOLDS.onlyMoveMarginCp).toBe(150)
    expect(BRILLIANT_THRESHOLDS.bystanderTakerMaxWinPct).toBe(10)
    expect(BRILLIANT_THRESHOLDS.minWinAfterPct).toBe(40)
  })
})
