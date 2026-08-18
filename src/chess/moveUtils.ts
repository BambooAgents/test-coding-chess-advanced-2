/**
 * Shared utilities for converting chess.js move objects to our MoveInfo type.
 */

import type { Move as ChessJsMove } from 'chess.js'
import type { MoveInfo } from './types'

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

/**
 * Convert a chess.js verbose move to our MoveInfo.
 */
export function verboseToMoveInfoHelper(m: ChessJsMove): MoveInfo {
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
