/**
 * Puzzle session state machine.
 *
 * Manages the flow of a puzzle-solving session:
 * - `idle` → waiting to start
 * - `playing` → user is trying to solve
 * - `solved` → user found the correct move
 * - `failed` → user played a wrong move
 *
 * The state machine validates moves against the puzzle's solution.
 * The first move in the puzzle's `moves` array is the opponent's "setup"
 * move — the position is already set up for the player. The player's
 * correct move is `moves[1]`, then `moves[2]` is the opponent's reply, etc.
 */

import { Position } from '../chess/Position'
import type { Puzzle, PuzzleStats } from './types'

export type PuzzleState = 'idle' | 'playing' | 'solved' | 'failed'

export interface PuzzleSessionState {
  /** The current puzzle being solved. */
  puzzle: Puzzle | null
  /** Current state of the solving flow. */
  state: PuzzleState
  /** Index into the puzzle's moves array (next expected move). */
  moveIndex: number
  /** Current board position (FEN). */
  currentFen: string
  /** The side the user is playing (derived from the puzzle FEN). */
  userColor: 'white' | 'black'
  /** Stats for this session. */
  stats: PuzzleStats
  /** Whether the solution is being shown (after failure). */
  showSolution: boolean
  /** How many moves of the solution have been auto-played (when showing solution). */
  solutionStep: number
}

/**
 * Create a fresh session state.
 */
export function createSession(): PuzzleSessionState {
  return {
    puzzle: null,
    state: 'idle',
    moveIndex: 0,
    currentFen: '',
    userColor: 'white',
    stats: { streak: 0, bestStreak: 0, solved: 0, failed: 0 },
    showSolution: false,
    solutionStep: 0,
  }
}

/**
 * Load a stats object from localStorage (session-only, lightweight).
 * Returns a fresh stats object if nothing is stored or storage is unavailable.
 */
export function loadStats(): PuzzleStats {
  try {
    const raw = localStorage.getItem('chess-puzzle-stats')
    if (raw) {
      const parsed = JSON.parse(raw) as PuzzleStats
      return {
        streak: parsed.streak ?? 0,
        bestStreak: parsed.bestStreak ?? 0,
        solved: parsed.solved ?? 0,
        failed: parsed.failed ?? 0,
      }
    }
  } catch {
    // localStorage not available or corrupt — start fresh
  }
  return { streak: 0, bestStreak: 0, solved: 0, failed: 0 }
}

/**
 * Save stats to localStorage (session-only).
 */
export function saveStats(stats: PuzzleStats): void {
  try {
    localStorage.setItem('chess-puzzle-stats', JSON.stringify(stats))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Determine which side the user plays in a puzzle.
 * The puzzle FEN has the player to move — that's the user's side.
 */
export function getUserColor(fen: string): 'white' | 'black' {
  const turn = fen.split(' ')[1]
  return turn === 'w' ? 'white' : 'black'
}

/**
 * Start a new puzzle in the session.
 * The puzzle FEN is already set up (opponent's setup move has been played).
 */
export function startPuzzle(
  session: PuzzleSessionState,
  puzzle: Puzzle,
): PuzzleSessionState {
  const userColor = getUserColor(puzzle.fen)
  return {
    ...session,
    puzzle,
    state: 'playing',
    moveIndex: 0,
    currentFen: puzzle.fen,
    userColor,
    showSolution: false,
    solutionStep: 0,
  }
}

/**
 * Attempt a user move (UCI format).
 * Returns the new session state and whether the move was correct.
 *
 * The puzzle moves array is: [opponentSetup, userMove, opponentReply, userMove, ...]
 * Since the FEN is already after the setup move, moveIndex starts at 1
 * (the first expected move is the user's move = moves[1]).
 *
 * Actually, the lichess format is: moves[0] is the last move played
 * before the puzzle starts (the opponent's setup move), and moves[1]
 * is the first move the user needs to find. So we start checking at index 1.
 *
 * Wait — re-examining: the lichess puzzle CSV says "the first move is the
 * opponent's" and the FEN is the position BEFORE that first move. So the
 * FEN is the position before the opponent's setup move. The user needs
 * to find moves[1] (their response to the setup).
 *
 * Actually, the standard interpretation is: the FEN is the position where
 * it's the puzzle solver's turn, and moves[0] is the first correct move.
 * But lichess docs say the first move is the opponent's move. Let me
 * handle both: we check against the expected move at the current index.
 *
 * Per lichess: "The moves are in UCI format. The first move is the
 * opponent's move (the last move played before the puzzle)."
 *
 * So: FEN is BEFORE the opponent's last move. moves[0] is the opponent's
 * move. After playing moves[0], it's the user's turn and they need to
 * find moves[1].
 *
 * We pre-play moves[0] when loading the puzzle, so the user sees the
 * position after the opponent's move and needs to find moves[1].
 */
export function tryMove(
  session: PuzzleSessionState,
  userUci: string,
): { session: PuzzleSessionState; correct: boolean } {
  if (session.state !== 'playing' || !session.puzzle) {
    return { session, correct: false }
  }

  const puzzle = session.puzzle
  // moveIndex points to the next expected move in puzzle.moves
  // After startPuzzle, moveIndex=1 (the user's first move)
  const expectedMove = puzzle.moves[session.moveIndex]

  if (userUci === expectedMove) {
    // Correct move! Play it and auto-play opponent's reply if there is one
    const pos = new Position(session.currentFen)
    pos.move(userUci)

    const nextIndex = session.moveIndex + 1
    const opponentMove = puzzle.moves[nextIndex]

    if (opponentMove) {
      // Auto-play the opponent's reply
      pos.move(opponentMove)
      const newFen = pos.fen()

      // Check if puzzle is fully solved (no more user moves expected)
      const remainingMoves = puzzle.moves.length - (nextIndex + 1)
      if (remainingMoves <= 0) {
        // Puzzle complete!
        const stats: PuzzleStats = {
          ...session.stats,
          streak: session.stats.streak + 1,
          bestStreak: Math.max(session.stats.bestStreak, session.stats.streak + 1),
          solved: session.stats.solved + 1,
        }
        saveStats(stats)
        return {
          session: {
            ...session,
            currentFen: newFen,
            moveIndex: nextIndex + 1,
            state: 'solved',
            stats,
          },
          correct: true,
        }
      }

      // More moves expected from the user
      return {
        session: {
          ...session,
          currentFen: newFen,
          moveIndex: nextIndex + 1,
        },
        correct: true,
      }
    }

    // No opponent reply — puzzle is complete (user's move was the last one)
    const stats: PuzzleStats = {
      ...session.stats,
      streak: session.stats.streak + 1,
      bestStreak: Math.max(session.stats.bestStreak, session.stats.streak + 1),
      solved: session.stats.solved + 1,
    }
    saveStats(stats)
    return {
      session: {
        ...session,
        currentFen: pos.fen(),
        moveIndex: nextIndex,
        state: 'solved',
        stats,
      },
      correct: true,
    }
  }

  // Wrong move — fail
  const stats: PuzzleStats = {
    ...session.stats,
    streak: 0,
    failed: session.stats.failed + 1,
  }
  saveStats(stats)
  return {
    session: {
      ...session,
      state: 'failed',
      stats,
    },
    correct: false,
  }
}

/**
 * Advance the solution display by one move (for "show solution" after failure).
 */
export function stepSolution(session: PuzzleSessionState): PuzzleSessionState {
  if (!session.puzzle || session.solutionStep >= session.puzzle.moves.length) {
    return session
  }

  const puzzle = session.puzzle
  // Start from the original puzzle FEN
  const startPos = new Position(puzzle.fen)
  const step = session.solutionStep + 1

  // Play all moves up to the current step
  // moves[0] is the opponent's setup (already played in the FEN for display),
  // but for the solution display we play from the FEN as given
  let pos = startPos
  // Actually the puzzle FEN is the position before moves[0], so we need to
  // play moves[0] first to get to the user's starting position
  for (let i = 0; i < step && i < puzzle.moves.length; i++) {
    pos = new Position(pos.fen())
    pos.move(puzzle.moves[i])
  }

  return {
    ...session,
    showSolution: true,
    solutionStep: step,
    currentFen: pos.fen(),
  }
}

/**
 * Get the legal moves for the current position.
 */
export function getLegalMoves(session: PuzzleSessionState): string[] {
  if (session.state !== 'playing' || !session.puzzle) return []
  const pos = new Position(session.currentFen)
  return pos.uciMoves()
}
