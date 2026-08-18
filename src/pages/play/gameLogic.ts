/**
 * Game logic helpers for the Play page.
 *
 * Pure functions for take-back computation and game state checks.
 */

import type { Color } from '../../chess'

/**
 * Compute the target ply count after a take-back.
 *
 * The player takes back their last move plus the engine's reply,
 * so we undo a pair of moves (player + engine). If the engine hasn't
 * replied yet (player just moved), we undo just the player's move
 * (or player + preceding engine move if available).
 *
 * @param currentPly - current number of plies played
 * @param playerColor - the human player's color
 * @returns target ply count after take-back, or -1 if nothing to undo
 */
export function computeTakebackTarget(
  currentPly: number,
  playerColor: Color,
): number {
  if (currentPly === 0) return -1

  // playerColor === 'white': player moves on even plies (0, 2, 4...), engine on odd
  // playerColor === 'black': engine moves on even plies, player on odd

  const playerMovesOnEven = playerColor === 'white'
  const lastPlyIndex = currentPly - 1 // 0-indexed
  const lastWasPlayer = playerMovesOnEven
    ? lastPlyIndex % 2 === 0
    : lastPlyIndex % 2 === 1

  if (lastWasPlayer) {
    // Player just moved; engine hasn't replied yet.
    // Take back the player's move AND the engine's preceding move,
    // so we go back to the player's turn. If there's no preceding
    // engine move (player moved first), just undo the player's move.
    return currentPly >= 2 ? currentPly - 2 : currentPly - 1
  } else {
    // Engine just replied. Undo both the engine's reply and the
    // player's move that prompted it, back to player's turn.
    return currentPly - 2
  }
}
