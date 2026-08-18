/**
 * Puzzles module — barrel export.
 */

export type { Puzzle, PuzzleIndex, PuzzleStats } from './types'
export {
  parsePuzzleRow,
  buildIndex,
  filterByRating,
  getByTheme,
  getByOpening,
  getEndgamePuzzles,
  shuffle,
} from './loader'
export {
  getPuzzleIndex,
  getAllPuzzles,
  getPuzzleCount,
} from './data'
export {
  type PuzzleState,
  type PuzzleSessionState,
  createSession,
  loadStats,
  saveStats,
  getUserColor,
  startPuzzle,
  tryMove,
  stepSolution,
  getLegalMoves,
} from './stateMachine'
