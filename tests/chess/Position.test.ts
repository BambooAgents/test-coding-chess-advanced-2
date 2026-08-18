/**
 * Tests for the Position wrapper — board, move generation, special moves, draws.
 */

import { describe, it, expect } from 'vitest'
import { Position } from '../../src/chess/Position'

describe('Position — basic', () => {
  it('starts with the standard FEN', () => {
    const pos = new Position()
    expect(pos.fen()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
    expect(pos.turn()).toBe('white')
    expect(pos.moveCount()).toBe(20)
  })

  it('creates from FEN', () => {
    const pos = Position.fromFen('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2')
    expect(pos.turn()).toBe('white')
  })

  it('makes moves and updates FEN', () => {
    const pos = new Position()
    const move = pos.move('e2e4')
    expect(move.uci).toBe('e2e4')
    expect(move.san).toBe('e4')
    expect(pos.turn()).toBe('black')
  })

  it('undoes moves', () => {
    const pos = new Position()
    const fenBefore = pos.fen()
    pos.move('e2e4')
    pos.undo()
    expect(pos.fen()).toBe(fenBefore)
  })

  it('clones independently', () => {
    const pos = new Position()
    pos.move('e2e4')
    const clone = pos.clone()
    clone.move('e7e5')
    expect(pos.fen()).not.toBe(clone.fen())
  })
})

describe('Position — legal moves', () => {
  it('lists UCI moves', () => {
    const pos = new Position()
    const uci = pos.uciMoves()
    expect(uci).toContain('e2e4')
    expect(uci).toContain('g1f3')
    expect(uci.length).toBe(20)
  })

  it('lists SAN moves', () => {
    const pos = new Position()
    const san = pos.sanMoves()
    expect(san).toContain('e4')
    expect(san).toContain('Nf3')
    expect(san.length).toBe(20)
  })

  it('returns full move info with FEN before/after', () => {
    const pos = new Position()
    const moves = pos.moves()
    const e4 = moves.find((m) => m.uci === 'e2e4')
    expect(e4).toBeDefined()
    expect(e4!.from).toBe('e2')
    expect(e4!.to).toBe('e4')
    expect(e4!.piece).toBe('pawn')
    expect(e4!.color).toBe('white')
    expect(e4!.fenBefore).toContain('rnbqkbnr/pppppppp')
    expect(e4!.fenAfter).toContain('rnbqkbnr/pppppppp/8/8/4P3')
  })
})

describe('Position — castling', () => {
  it('allows kingside castling for white', () => {
    // Kiwipete-like position with castling rights
    const fen = 'rnbqk2r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 6 5'
    const pos2 = Position.fromFen(fen)
    expect(pos2.fen()).toContain('RNBQ1RK1')
  })

  it('allows kingside castling (O-O) for white', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'
    const pos = Position.fromFen(fen)
    const uci = pos.uciMoves()
    expect(uci).toContain('e1g1') // O-O
    expect(uci).toContain('e1c1') // O-O-O
  })

  it('disallows castling through check', () => {
    // King on e1, rook on h1, enemy rook on e8 giving check on e-file
    const fen = '4r1k1/8/8/8/8/8/8/4K2R w K - 0 1'
    const pos = Position.fromFen(fen)
    const uci = pos.uciMoves()
    // Can't castle kingside because king is in check on e-file
    expect(uci).not.toContain('e1g1')
  })

  it('disallows castling into check', () => {
    // King on e1, rook on h1, enemy rook on g8 attacks g-file (king lands on g1)
    const fen = '5r1k/8/8/8/8/8/8/4K2R w K - 0 1'
    const pos = Position.fromFen(fen)
    const uci = pos.uciMoves()
    // Can't castle kingside — king would pass through g1 which is attacked
    expect(uci).not.toContain('e1g1')
  })
})

describe('Position — en passant', () => {
  it('allows en passant capture', () => {
    // After 1.e4 ... d5 2.e5 ... f5, white can capture en passant: exf6
    const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3'
    const pos = Position.fromFen(fen)
    const uci = pos.uciMoves()
    expect(uci).toContain('e5f6') // en passant
  })

  it('records en passant capture correctly', () => {
    const fen = 'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3'
    const pos = Position.fromFen(fen)
    const move = pos.move('e5f6')
    expect(move.uci).toBe('e5f6')
    expect(move.san).toBe('exf6')
    expect(move.captured).toBe('pawn')
  })
})

describe('Position — promotion', () => {
  it('allows promotion to queen', () => {
    const fen = '8/4P3/8/8/8/8/8/4k2K w - - 0 1'
    const pos = Position.fromFen(fen)
    const uci = pos.uciMoves()
    expect(uci).toContain('e7e8q')
    expect(uci).toContain('e7e8r')
    expect(uci).toContain('e7e8b')
    expect(uci).toContain('e7e8n')
  })

  it('records promotion correctly', () => {
    // Use a position where promotion doesn't give check (black king on e5)
    const fen = '8/1P6/4k3/8/8/8/8/7K w - - 0 1'
    const pos = Position.fromFen(fen)
    const move = pos.move('b7b8q')
    expect(move.uci).toBe('b7b8q')
    expect(move.promotion).toBe('queen')
    expect(move.san).toBe('b8=Q')
  })
})

describe('Position — check/checkmate/stalemate', () => {
  it('detects check', () => {
    // Black rook on e2 checks white king on e1
    const fen = '4k3/8/8/8/8/8/4r3/4K3 w - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.inCheck()).toBe(true)
  })

  it('detects checkmate (fool\'s mate)', () => {
    // 1.f3 e5 2.g4 Qh4# — correct FEN with move 3 and lowercase q
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'
    const pos = Position.fromFen(fen)
    expect(pos.isCheckmate()).toBe(true)
    expect(pos.isGameOver()).toBe(true)
  })

  it('detects stalemate', () => {
    // Black king on a8, white queen on c7, white king on c6 — stalemate
    const fen = 'k7/2Q5/2K5/8/8/8/8/8 b - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.isStalemate()).toBe(true)
    expect(pos.isGameOver()).toBe(true)
    expect(pos.drawReason()).toBe('stalemate')
  })
})

describe('Position — draws', () => {
  it('detects insufficient material (K vs K)', () => {
    const fen = '4k3/8/8/8/8/8/8/4K3 w - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.isInsufficientMaterial()).toBe(true)
    expect(pos.drawReason()).toBe('insufficient_material')
  })

  it('detects insufficient material (K+B vs K)', () => {
    const fen = '4k3/8/8/8/8/8/8/4KB2 w - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.isInsufficientMaterial()).toBe(true)
  })

  it('does not flag K+R vs K as insufficient material', () => {
    const fen = '4k3/8/8/8/8/8/8/4KR2 w - - 0 1'
    const pos = Position.fromFen(fen)
    expect(pos.isInsufficientMaterial()).toBe(false)
  })
})

describe('Position — game state', () => {
  it('reports ongoing game at start', () => {
    const pos = new Position()
    expect(pos.outcome()).toBe('ongoing')
  })

  it('reports white_win on black checkmate', () => {
    // Black is checkmated — it's black to move
    // Scholar's mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
    const fen = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4'
    const pos = Position.fromFen(fen)
    expect(pos.outcome()).toBe('white_win')
  })

  it('reports ply count', () => {
    const pos = new Position()
    expect(pos.ply()).toBe(0)
    pos.move('e2e4')
    expect(pos.ply()).toBe(1)
    pos.move('e7e5')
    expect(pos.ply()).toBe(2)
  })

  it('reports full move number', () => {
    const pos = new Position()
    expect(pos.fullMoveNumber()).toBe(1)
    pos.move('e2e4')
    expect(pos.fullMoveNumber()).toBe(1)
    pos.move('e7e5')
    expect(pos.fullMoveNumber()).toBe(2)
  })
})

describe('Position — board', () => {
  it('returns a map of squares to pieces', () => {
    const pos = new Position()
    const board = pos.board()
    expect(board.size).toBe(32)
    expect(board.get('a1')).toEqual({ type: 'r', color: 'w' })
    expect(board.get('e1')).toEqual({ type: 'k', color: 'w' })
    expect(board.get('e8')).toEqual({ type: 'k', color: 'b' })
    expect(board.get('e4')).toBeUndefined()
  })

  it('gets piece at a square', () => {
    const pos = new Position()
    expect(pos.pieceAt('a1')).toEqual({ type: 'r', color: 'w' })
    expect(pos.pieceAt('e4')).toBeNull()
  })
})
