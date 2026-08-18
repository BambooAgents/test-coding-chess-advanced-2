/**
 * Tests for phase detection — material-based heuristic.
 */

import { describe, it, expect } from 'vitest'
import { Position } from '../../src/chess/Position'

describe('Phase detection', () => {
  it('opening at start position', () => {
    const pos = new Position()
    expect(pos.phase()).toBe('opening')
  })

  it('opening after a few moves', () => {
    const pos = new Position()
    pos.move('e2e4')
    pos.move('e7e5')
    pos.move('g1f3')
    expect(pos.phase()).toBe('opening')
  })

  it('endgame with K+R vs K', () => {
    // King and Rook vs King — should be endgame
    const fen = '4k3/8/8/8/8/8/8/4KR2 w - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.phase()).toBe('endgame')
  })

  it('endgame with K+Q vs K', () => {
    const fen = '4k3/8/8/8/8/8/8/4KQ2 w - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.phase()).toBe('endgame')
  })

  it('middlegame with full material at move 40', () => {
    // This is hard to construct perfectly; use a position with lots of material
    // but at a high move number. The material check should keep it as middlegame.
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 40'
    const pos = Position.fromFen(fen)
    expect(pos.phase()).not.toBe('endgame')
  })

  it('endgame with only kings and pawns', () => {
    const fen = '4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.phase()).toBe('endgame')
  })

  it('endgame with K+B vs K+P', () => {
    const fen = '4k3/4p3/8/8/8/8/4B3/4K3 w - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.phase()).toBe('endgame')
  })
})
