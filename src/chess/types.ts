/**
 * Core domain types for the chess library.
 *
 * These types are the public contract that the rest of the app depends on.
 * No implementation, no UI — pure types.
 */

/** Piece colors. */
export type Color = 'white' | 'black'

/** The six piece types (no king for pawn-promotion targets — king excluded). */
export type PieceType = 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen'

/** All piece types including king. */
export type PieceKind = PieceType | 'king'

/** A position on the board, algebraic notation e.g. "e4". */
export type Square = string

/** A move in UCI long-algebraic notation, e.g. "e2e4", "e7e8q" (promotion). */
export interface UciMove {
  from: Square
  to: Square
  promotion?: 'q' | 'r' | 'b' | 'n'
}

/** A move with full context (SAN, FEN before/after, etc). */
export interface MoveInfo {
  /** UCI string, e.g. "e2e4" */
  uci: string
  /** SAN string, e.g. "Nf3" */
  san: string
  from: Square
  to: Square
  color: Color
  piece: PieceKind
  captured?: PieceKind
  promotion?: PieceType
  flags: string
  /** FEN before this move was played */
  fenBefore: string
  /** FEN after this move was played */
  fenAfter: string
}

/** Engine evaluation score. */
export interface EvalScore {
  /** Centipawn score from White's perspective. Present when not a mate score. */
  cp?: number
  /** Mate in N moves (positive = White mates, negative = Black mates). */
  mate?: number
  /** Depth the evaluation was computed at. */
  depth?: number
}

/** Game phase classification. */
export type GamePhase = 'opening' | 'middlegame' | 'endgame'

/** Draw reasons. */
export type DrawReason =
  | 'stalemate'
  | 'insufficient_material'
  | 'threefold_repetition'
  | 'fifty_move_rule'

/** Game result. */
export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*'

/** Game outcome. */
export type GameOutcome = 'white_win' | 'black_win' | 'draw' | 'ongoing'

/** PGN header key-value pairs. */
export type PgnHeaders = Record<string, string>

/** A parsed chess game. */
export interface ParsedGame {
  headers: PgnHeaders
  moves: MoveInfo[]
  result: GameResult
  /** The FEN of the starting position (standard start unless SetUp/FEN in headers). */
  startingFen: string
}

/** Move classification badges (eval-delta based). Brilliant is separate (ticket #15). */
export type MoveClassification =
  | 'book'
  | 'brilliant'
  | 'best'
  | 'great'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'no_annotation'

/** Classification glyph for display. */
export const CLASSIFICATION_GLYPHS: Record<MoveClassification, string> = {
  book: '',
  brilliant: '!!',
  best: '!',
  great: '!!',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  no_annotation: '',
}

/** Classification labels for display. */
export const CLASSIFICATION_LABELS: Record<MoveClassification, string> = {
  book: 'Book',
  brilliant: 'Brilliant',
  best: 'Best',
  great: 'Great',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  no_annotation: '',
}

/** Input to classifyMove(). */
export interface ClassifyMoveInput {
  /** The color of the player making the move. */
  color: Color
  /** Eval before the move (White's POV). */
  evalBefore: EvalScore
  /** Eval after the move (White's POV). */
  evalAfter: EvalScore
  /** Best eval for the position before the move (White's POV). */
  bestEval: EvalScore
  /** Does the played move deliver checkmate? */
  isCheckmate: boolean
  /** Number of legal moves in the position before this move. */
  legalMoveCount: number
  /** Ply number (0-indexed: 0 = White's first move). */
  ply: number
  /** Is this in the opening phase? (ply < 20). */
  isOpening: boolean
  /** Did the played move match the engine's best move (UCI)? */
  isBestMove: boolean
  /** Previous move classification by the same player (for Great detection). */
  prevOwnClassification?: MoveClassification
  /** Previous move classification by the opponent (for Great detection). */
  prevOppClassification?: MoveClassification
}
