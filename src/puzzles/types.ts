/**
 * Puzzle domain types.
 *
 * A puzzle is a position (FEN) where the player must find the correct
 * sequence of moves. The first move in the solution is the opponent's
 * move (the "setup" move), then the player's move, then the opponent's
 * reply, and so on — matching the lichess puzzle CSV format.
 */

/** A single puzzle from the lichess puzzle database (CC0). */
export interface Puzzle {
  /** Lichess puzzle ID (e.g. "00Q42Nod+8d2"). */
  id: string
  /** FEN of the puzzle position (opponent has just moved, it's the player's turn). */
  fen: string
  /**
   * Solution moves as space-separated UCI strings.
   * The first move is the opponent's "setup" move, the second is the
   * player's correct response, the third is the opponent's reply, etc.
   * e.g. "e2e4 e7e5 g1f3" means: opponent played e2e4, player must play e7e5,
   * then opponent plays g1f3 (if the puzzle continues).
   */
  moves: string[]
  /** Lichess puzzle rating (estimated difficulty). */
  rating: number
  /** Rating deviation (confidence). */
  ratingDeviation: number
  /** Popularity (thumbs up - thumbs down). */
  popularity: number
  /** Number of times played on lichess. */
  nbPlays: number
  /** Themes/tags (e.g. "endgame", "rookEndgame", "fork", "pin"). */
  themes: string[]
  /** Opening tags (e.g. "Kings_Gambit", "Ruy_Lopez"). Empty if none. */
  openingTags: string[]
  /** URL of the game this puzzle came from. */
  gameUrl: string
}

/** Index of puzzles organized by theme and opening. */
export interface PuzzleIndex {
  /** All puzzles. */
  all: Puzzle[]
  /** Map of theme → puzzles with that theme. */
  byTheme: Map<string, Puzzle[]>
  /** Map of opening tag → puzzles with that opening tag. */
  byOpening: Map<string, Puzzle[]>
  /** All unique theme names. */
  themes: string[]
  /** All unique opening tag names. */
  openings: string[]
  /** Rating bands for filtering. */
  ratingBands: { min: number; max: number; label: string }[]
}

/**
 * Session-only puzzle stats (localStorage, no cross-session persistence of
 * game data — just lightweight runtime stats).
 */
export interface PuzzleStats {
  /** Current solve streak. */
  streak: number
  /** Best streak this session. */
  bestStreak: number
  /** Total puzzles solved. */
  solved: number
  /** Total puzzles failed. */
  failed: number
}
