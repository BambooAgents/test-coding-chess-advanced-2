/**
 * Board wrapper — wraps chess.js in a clean module so the rest of the app
 * depends on our wrapper, not chess.js directly.
 *
 * Provides: board representation, legal move generation, make/unmake move,
 * check/checkmate/stalemate, castling, en passant, promotion, draws.
 */

import { Chess, type Move as ChessJsMove } from 'chess.js'
import type {
  Color,
  GameOutcome,
  GamePhase,
  DrawReason,
  MoveInfo,
  Square,
  UciMove,
} from './types'
import { detectPhase } from './phase'

/**
 * A position on the board. Wraps chess.js's Chess class.
 */
export class Position {
  private chess: Chess

  constructor(fen?: string) {
    this.chess = fen ? new Chess(fen) : new Chess()
  }

  /** Get the current FEN. */
  fen(): string {
    return this.chess.fen()
  }

  /** Create a Position from a FEN string. */
  static fromFen(fen: string): Position {
    return new Position(fen)
  }

  /** The side to move. */
  turn(): Color {
    return this.chess.turn() === 'w' ? 'white' : 'black'
  }

  /** Get all legal moves in UCI format. */
  uciMoves(): string[] {
    return this.chess.moves({ verbose: true }).map((m) => m.lan)
  }

  /** Get all legal moves in SAN format. */
  sanMoves(): string[] {
    return this.chess.moves()
  }

  /** Get all legal moves with full info. */
  moves(): MoveInfo[] {
    return this.chess.moves({ verbose: true }).map((m) => verboseToMoveInfo(m))
  }

  /** Number of legal moves. */
  moveCount(): number {
    return this.chess.moves().length
  }

  /** Make a move (UCI or SAN). Returns the MoveInfo or throws. */
  move(uci: string): MoveInfo {
    const result = this.chess.move(uci)
    return verboseToMoveInfo(result)
  }

  /** Make a move from UCI components. */
  moveUci(m: UciMove): MoveInfo {
    const uciStr = m.promotion ? `${m.from}${m.to}${m.promotion}` : `${m.from}${m.to}`
    return this.move(uciStr)
  }

  /** Undo the last move. */
  undo(): void {
    this.chess.undo()
  }

  /** Is the king in check? */
  inCheck(): boolean {
    return this.chess.inCheck()
  }

  /** Is it checkmate? */
  isCheckmate(): boolean {
    return this.chess.isCheckmate()
  }

  /** Is it stalemate? */
  isStalemate(): boolean {
    return this.chess.isStalemate()
  }

  /** Is it a draw? */
  isDraw(): boolean {
    return this.chess.isDraw()
  }

  /** Is it a threefold repetition? */
  isThreefoldRepetition(): boolean {
    return this.chess.isThreefoldRepetition()
  }

  /** Is it insufficient material? */
  isInsufficientMaterial(): boolean {
    return this.chess.isInsufficientMaterial()
  }

  /** Is the game over (checkmate, stalemate, draw, fifty-move)? */
  isGameOver(): boolean {
    return this.chess.isGameOver()
  }

  /** Get the draw reason if the game is a draw. */
  drawReason(): DrawReason | null {
    if (this.isStalemate()) return 'stalemate'
    if (this.isInsufficientMaterial()) return 'insufficient_material'
    if (this.isThreefoldRepetition()) return 'threefold_repetition'
    // chess.js isDraw() covers fifty-move rule + the above
    if (this.isDraw()) return 'fifty_move_rule'
    return null
  }

  /** Get the game outcome. */
  outcome(): GameOutcome {
    if (this.isCheckmate()) {
      return this.turn() === 'white' ? 'black_win' : 'white_win'
    }
    if (this.isDraw()) return 'draw'
    return 'ongoing'
  }

  /** Get the game phase based on material and ply. */
  phase(): GamePhase {
    return detectPhase(this.chess)
  }

  /** Get the board as a map of square → piece. */
  board(): Map<Square, { type: string; color: 'w' | 'b' }> {
    const result = new Map<Square, { type: string; color: 'w' | 'b' }>()
    const b = this.chess.board()
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = b[rank][file]
        if (piece) {
          const sq = 'abcdefgh'[file] + (8 - rank)
          result.set(sq, { type: piece.type, color: piece.color })
        }
      }
    }
    return result
  }

  /** Get piece at a square, or null. */
  pieceAt(sq: Square): { type: string; color: 'w' | 'b' } | null {
    const p = this.chess.get(sq as Parameters<typeof this.chess.get>[0])
    return p ? { type: p.type, color: p.color } : null
  }

  /** Get the half-move clock (for fifty-move rule). */
  halfMoveClock(): number {
    // Parse from FEN — chess.js doesn't expose this directly
    const fenParts = this.chess.fen().split(' ')
    return parseInt(fenParts[4] ?? '0', 10)
  }

  /** Get the fullmove number. */
  fullMoveNumber(): number {
    const fenParts = this.chess.fen().split(' ')
    return parseInt(fenParts[5] ?? '1', 10)
  }

  /** Get the ply count (0-indexed). */
  ply(): number {
    const fenParts = this.chess.fen().split(' ')
    const fullMove = parseInt(fenParts[5] ?? '1', 10)
    const turn = fenParts[1] ?? 'w'
    // White's first move of move N is ply (N-1)*2; Black's is (N-1)*2+1
    return turn === 'w' ? (fullMove - 1) * 2 : (fullMove - 1) * 2 + 1
  }

  /** Clone this position. */
  clone(): Position {
    return Position.fromFen(this.fen())
  }

  /** Get the underlying chess.js instance (for advanced use). */
  raw(): Chess {
    return this.chess
  }
}

/** Convert a chess.js verbose move to our MoveInfo. */
function verboseToMoveInfo(m: ChessJsMove): MoveInfo {
  const pieceMap: Record<string, string> = {
    p: 'pawn',
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
    k: 'king',
  }

  const promotionMap: Record<string, 'knight' | 'bishop' | 'rook' | 'queen'> = {
    n: 'knight',
    b: 'bishop',
    r: 'rook',
    q: 'queen',
  }

  return {
    uci: m.lan,
    san: m.san,
    from: m.from,
    to: m.to,
    color: m.color === 'w' ? 'white' : 'black',
    piece: pieceMap[m.piece] as MoveInfo['piece'],
    captured: m.captured ? (pieceMap[m.captured] as MoveInfo['captured']) : undefined,
    promotion: m.promotion ? promotionMap[m.promotion] : undefined,
    flags: m.flags,
    fenBefore: m.before,
    fenAfter: m.after,
  }
}
