/**
 * SEE (Static Exchange Evaluation) + hanging-piece bait detection.
 *
 * Used by the Brilliant heuristic to find a real net sacrifice: after the
 * move, the opponent must have a profitable capture of a piece worth ≥ 3.
 *
 * Piece values: standard chess point values (pawn=1, N/B=3, R=5, Q=9).
 * King is excluded (you can't capture the king).
 *
 * NOTE: Attack detection here is geometric (piece movement patterns), not
 * legal-move based, so it finds attackers of BOTH colors regardless of
 * whose turn it is. Pins/checks are ignored (acceptable for the bait
 * heuristic — a pinned piece still "attacks" for SEE purposes; the SEE
 * recursion assumes captures are legal).
 */

import { Position } from './Position'
import type { Square } from './types'

/** Standard material point values. King = 0 (uncapturable). */
export const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
}

/** The result of SEE on a single square. */
export interface SeeResult {
  square: Square
  capturedValue: number
  /** Net material gain for the side initiating the capture (the SEE score). */
  profit: number
}

/** Convert a square string ("e4") to [file, rank] (0-7, 0-7). */
function toCoords(sq: Square): [number, number] {
  return [sq.charCodeAt(0) - 97, parseInt(sq[1], 10) - 1]
}

/** Convert [file, rank] to a square string. */
function toSquare(file: number, rank: number): Square {
  return String.fromCharCode(97 + file) + (rank + 1)
}

/**
 * Find all pieces attacking `square`, separated by color, using geometric
 * piece-movement patterns (not legal moves, so both colors are found).
 */
function findAttackers(pos: Position, square: Square): {
  white: { square: Square; value: number }[]
  black: { square: Square; value: number }[]
} {
  const white: { square: Square; value: number }[] = []
  const black: { square: Square; value: number }[] = []
  const [tf, tr] = toCoords(square)

  const knightDeltas = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
  const kingDeltas = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]

  const add = (color: 'w' | 'b', from: Square, value: number) => {
    (color === 'w' ? white : black).push({ square: from, value })
  }

  for (const [sqStr, piece] of pos.board().entries()) {
    const [pf, pr] = toCoords(sqStr)
    const color = piece.color // 'w' | 'b'
    const type = piece.type
    const value = PIECE_VALUES[type] ?? 0
    const df = tf - pf
    const dr = tr - pr

    if (type === 'n') {
      if (knightDeltas.some(([a, b]) => a === df && b === dr)) add(color, sqStr, value)
    } else if (type === 'k') {
      if (kingDeltas.some(([a, b]) => a === df && b === dr)) add(color, sqStr, value)
    } else if (type === 'p') {
      // Pawn captures diagonally. White pawns capture up (rank+1), black down (rank-1).
      const dir = color === 'w' ? 1 : -1
      if (dr === dir && Math.abs(df) === 1) add(color, sqStr, value)
    } else {
      // Sliding pieces: bishop, rook, queen. Walk the rays.
      const canDiag = type === "b" || type === "q"
      const canStraight = type === "r" || type === "q"

      if (canDiag && Math.abs(df) === Math.abs(dr) && df !== 0) {
        if (rayClear(pos, pf, pr, tf, tr)) add(color, sqStr, value)
      } else if (canStraight && (df === 0 || dr === 0) && (df !== 0 || dr !== 0)) {
        if (rayClear(pos, pf, pr, tf, tr)) add(color, sqStr, value)
      }
    }
  }

  return { white, black }
}

/** Check if the ray from (pf,pr) to (tf,tr) is clear of intervening pieces. */
function rayClear(pos: Position, pf: number, pr: number, tf: number, tr: number): boolean {
  const stepF = Math.sign(tf - pf)
  const stepR = Math.sign(tr - pr)
  let f = pf + stepF
  let r = pr + stepR
  while (f !== tf || r !== tr) {
    if (pos.pieceAt(toSquare(f, r))) return false
    f += stepF
    r += stepR
  }
  return true
}

/**
 * Compute the Static Exchange Evaluation for capturing on `square`.
 * `pos` is the position AFTER the move being analyzed. Returns the best
 * score the side-to-move can guarantee (standard negamax SEE).
 */
export function see(pos: Position, square: Square): number {
  const target = pos.pieceAt(square)
  if (!target) return 0

  const attackers = findAttackers(pos, square)
  const whiteAttackers = attackers.white.slice().sort((a, b) => a.value - b.value)
  const blackAttackers = attackers.black.slice().sort((a, b) => a.value - b.value)

  const turn = pos.turn()
  const capturedValue = PIECE_VALUES[target.type] ?? 0

  return seeGain(
    capturedValue,
    turn === 'white' ? whiteAttackers : blackAttackers,
    turn === 'white' ? blackAttackers : whiteAttackers,
  )
}

/** Recursive SEE: gain for the side to move, alternating. */
function seeGain(
  capturedValue: number,
  myAttackers: { square: Square; value: number }[],
  oppAttackers: { square: Square; value: number }[],
): number {
  if (myAttackers.length === 0) return 0
  const attacker = myAttackers[0]
  const gain = capturedValue - seeGain(
    attacker.value,
    oppAttackers,
    myAttackers.slice(1),
  )
  return Math.max(0, gain)
}

/**
 * Find the hanging-piece bait: the opponent's most profitable capture of a
 * piece worth ≥ 3, on the post-move board. Returns null if none.
 */
export function findHangingPieceBait(pos: Position): SeeResult | null {
  let best: SeeResult | null = null
  const moverColor = pos.turn() === 'white' ? 'b' : 'w' // the side that just moved

  for (const [sq, piece] of pos.board().entries()) {
    const value = PIECE_VALUES[piece.type] ?? 0
    if (value < 3) continue
    if (piece.color !== moverColor) continue // only the mover's pieces

    const profit = see(pos, sq)
    if (profit >= 1) {
      if (!best || profit > best.profit) {
        best = { square: sq, capturedValue: value, profit }
      }
    }
  }
  return best
}

// winPercent is re-exported from ./winningChances (single source of truth).
