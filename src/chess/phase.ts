/**
 * Game phase detection — material-based heuristic per the user's specification.
 *
 * "If at move 40 there's only King and Rook, that's endgame.
 *  If at move 40 we still see full material, that's still middlegame."
 *
 * Uses a material count heuristic: counts non-pawn, non-king pieces
 * and determines whether the position has transitioned to the endgame.
 */

import type { GamePhase } from './types'
import type { Chess } from 'chess.js'

// Piece values for material counting
const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
}

/**
 * Count total non-king material on the board (both sides).
 */
function totalMaterial(chess: Chess): number {
  let total = 0
  const board = chess.board()
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.type !== 'k') {
        total += PIECE_VALUES[piece.type] ?? 0
      }
    }
  }
  return total
}

/**
 * Count total queens on the board.
 */
function queenCount(chess: Chess): number {
  let count = 0
  const board = chess.board()
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.type === 'q') count++
    }
  }
  return count
}

/**
 * Count total minor pieces (knights + bishops) on the board.
 */
function minorPieceCount(chess: Chess): number {
  let count = 0
  const board = chess.board()
  for (const row of board) {
    for (const piece of row) {
      if (piece && (piece.type === 'n' || piece.type === 'b')) count++
    }
  }
  return count
}

/**
 * Count total rooks on the board.
 */
function rookCount(chess: Chess): number {
  let count = 0
  const board = chess.board()
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.type === 'r') count++
    }
  }
  return count
}

/**
 * Detect the game phase using a material-based heuristic.
 *
 * - Opening: first ~10 moves (ply < 20) with most material still on the board.
 * - Endgame: low material (≤ ~13 points total, or few pieces: ≤ 1 queen,
 *   ≤ 2 minor pieces, ≤ 2 rooks, and total material ≤ ~13).
 * - Middlegame: everything else.
 *
 * This implements the user's specification: "move 40 with K+R = endgame;
 * move 40 with full material = still middlegame."
 */
export function detectPhase(chess: Chess): GamePhase {
  const ply = getPly(chess)
  const material = totalMaterial(chess)
  const queens = queenCount(chess)
  const minors = minorPieceCount(chess)
  const rooks = rookCount(chess)

  // Opening: ply < 20 and material is close to starting (≥ ~30 out of ~39)
  if (ply < 20 && material >= 30) {
    return 'opening'
  }

  // Endgame: low material. Starting material is ~39 (8 pawns + 2N + 2B + 2R + Q = 8+6+10+9 = 33 per side, 66 total... wait)
  // Actually: per side: 8P(8) + 2N(6) + 2B(6) + 2R(10) + Q(9) = 39. Total = 78.
  // Endgame threshold: total material ≤ 13 (roughly: K+R+P or K+minor+P per side)
  // OR: no queens, ≤ 2 rooks, ≤ 2 minor pieces total
  if (material <= 13 || (queens === 0 && rooks <= 2 && minors <= 2)) {
    return 'endgame'
  }

  // If queens have been exchanged and material is moderate
  if (queens === 0 && material <= 20) {
    return 'endgame'
  }

  return 'middlegame'
}

/**
 * Get the ply count from a chess.js instance.
 */
function getPly(chess: Chess): number {
  const fenParts = chess.fen().split(' ')
  const fullMove = parseInt(fenParts[5] ?? '1', 10)
  const turn = fenParts[1] ?? 'w'
  return turn === 'w' ? (fullMove - 1) * 2 : (fullMove - 1) * 2 + 1
}

/**
 * Check if a position is in garbage time (decisively won/lost).
 * |eval| > 700cp. This is checked with the engine eval, not material.
 */
export function isGarbageTime(bestEvalCp: number): boolean {
  return Math.abs(bestEvalCp) > 700
}
