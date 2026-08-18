/**
 * Chess core library — barrel export.
 *
 * This is the public API of the chess module. The rest of the app imports
 * from here, never from individual sub-modules.
 */

// Types
export type {
  Color,
  PieceType,
  PieceKind,
  Square,
  UciMove,
  MoveInfo,
  EvalScore,
  GamePhase,
  DrawReason,
  GameResult,
  GameOutcome,
  PgnHeaders,
  ParsedGame,
  MoveClassification,
  ClassifyMoveInput,
} from './types'
export {
  CLASSIFICATION_GLYPHS,
  CLASSIFICATION_LABELS,
} from './types'

// Board / position
export { Position } from './Position'

// PGN
export { parsePgn, parsePgnGames, writePgn } from './pgn'

// Chess.com
export {
  fetchChessComGames,
  fetchChessComArchives,
} from './chessCom'
export type {
  FetchChessComGamesOptions,
  ChessComGame,
} from './chessCom'

// Winning chances math
export {
  winningChances,
  mateWinningChances,
  evalWinningChances,
  povChances,
  povDiff,
  winPercent,
  evalToWinPercent,
  povWinPercent,
  accuracyFromWinPercents,
} from './winningChances'

// Move classification
export { classifyMove } from './classifyMove'

// Phase detection
export { detectPhase, isGarbageTime } from './phase'
