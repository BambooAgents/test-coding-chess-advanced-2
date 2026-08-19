import { describe, it, expect } from 'vitest'
import { Position } from '../../src/chess/Position'
import { see, findHangingPieceBait, PIECE_VALUES } from '../../src/chess/see'
import { winPercent } from '../../src/chess/winningChances'

describe('PIECE_VALUES', () => {
  it('has standard values', () => {
    expect(PIECE_VALUES.p).toBe(1)
    expect(PIECE_VALUES.n).toBe(3)
    expect(PIECE_VALUES.b).toBe(3)
    expect(PIECE_VALUES.r).toBe(5)
    expect(PIECE_VALUES.q).toBe(9)
    expect(PIECE_VALUES.k).toBe(0)
  })
})

describe('winPercent', () => {
  it('is 50 at 0cp (equal)', () => {
    expect(winPercent(0)).toBeCloseTo(50, 0)
  })
  it('is ~100 at huge positive cp', () => {
    expect(winPercent(1000)).toBeGreaterThan(95)
  })
  it('is ~0 at huge negative cp', () => {
    expect(winPercent(-1000)).toBeLessThan(5)
  })
})

describe('see', () => {
  it('returns 0 for an empty square', () => {
    const pos = new Position()
    expect(see(pos, 'e4')).toBe(0)
  })

  it('detects a free capture (no recapture) as profitable', () => {
    // White to move, free black knight on d5 (no recapture).
    // Position: white queen on d1, black knight on d5, nothing else nearby.
    const fen = '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1'
    const pos = new Position(fen)
    // The knight on d5 is capturable by Qxd5. SEE should report a profit.
    expect(see(pos, 'd5')).toBeGreaterThan(0)
  })

  it('detects a defended capture as a trade (low profit)', () => {
    // Knight on d5 defended by a pawn on e6. Qxd5 exd5 = trade.
    const pos = new Position('4k3/8/4p3/3n4/8/8/8/3QK3 w - - 0 1')
    // Qxd5 then exd5: white wins a knight (3) but loses a queen (9). Net = -6 for white.
    // SEE from white's perspective (white to move): should be ~0 (decline is better).
    // Actually the mover is white here; see() returns white's best gain.
    // White capturing: +3 (knight) - 9 (queen recaptured) = -6, so white declines → 0.
    expect(see(pos, 'd5')).toBe(0)
  })
})

describe('findHangingPieceBait', () => {
  it('finds a hanging queen (opponent to move can win it)', () => {
    // White queen on d5, black king on e6 can capture it (adjacent). Black to move.
    const pos = new Position('8/8/4k3/3Q4/8/8/8/4K3 b - - 0 1')
    const bait = findHangingPieceBait(pos)
    expect(bait).not.toBeNull()
    expect(bait!.capturedValue).toBe(9) // queen
    expect(bait!.profit).toBeGreaterThan(0)
  })

  it('returns null when no piece worth >= 3 is hanging', () => {
    // Starting position: nothing hangs.
    const fen = '4k3/8/8/3p4/8/8/8/3QK3 b - - 0 1' // only a pawn on d5
    const pos = new Position(fen)
    const bait = findHangingPieceBait(pos)
    expect(bait).toBeNull() // pawn (value 1) < 3
  })

  it('returns null in the starting position', () => {
    const pos = new Position()
    const bait = findHangingPieceBait(pos)
    expect(bait).toBeNull()
  })
})
