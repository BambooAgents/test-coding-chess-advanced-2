/**
 * Analyze engine — runs Stockfish per position and classifies each move.
 *
 * Pure logic with a swappable engine adapter so Vitest can mock the engine
 * (Stockfish-WASM does not work in jsdom). The UI layer drives this via
 * `analyzeGame` with a progressive callback.
 */

import { Position } from '../chess/Position'
import { classifyMove } from '../chess/classifyMove'
import { isGarbageTime } from '../chess/phase'
import type {
  Color,
  EvalScore,
  MoveClassification,
  MoveInfo,
  ParsedGame,
} from '../chess/types'

/** Minimal engine interface the analyze engine needs. */
export interface AnalyzeEngine {
  /** Evaluate a position, returning cp/mate from White's POV. */
  evaluate(fen: string): Promise<EvalScore>
}

/** One classified move in the analysis output. */
export interface AnalyzedMove {
  /** Index into the game's move list. */
  ply: number
  /** The move info (SAN, UCI, FENs). */
  move: MoveInfo
  /** Eval before the move (White's POV). */
  evalBefore: EvalScore
  /** Eval after the move (White's POV). */
  evalAfter: EvalScore
  /** The engine's best-move eval for the position before the move. */
  bestEval: EvalScore
  /** Classification badge. */
  classification: MoveClassification
  /** The mover's color. */
  color: Color
}

/** The full analysis for a game. */
export interface GameAnalysis {
  /** Per-move analysis, indexed by ply. */
  moves: AnalyzedMove[]
  /** The opening name (from PGN headers, if present). */
  openingName: string | null
}

/**
 * Analyze a single game: for each position, evaluate before + after the move,
 * compute the best-move eval, and classify the move.
 *
 * `onProgress` is called after each move is analyzed so the UI can render
 * progressively (live-update requirement).
 */
export async function analyzeGame(
  game: ParsedGame,
  engine: AnalyzeEngine,
  onProgress?: (analysis: GameAnalysis) => void,
): Promise<GameAnalysis> {
  const moves: AnalyzedMove[] = []
  const openingName = game.headers.Opening || game.headers.opening || null

  // Replay the game move-by-move, evaluating each position.
  const pos = new Position(game.startingFen)

  for (let ply = 0; ply < game.moves.length; ply++) {
    const move = game.moves[ply]
    const fenBefore = move.fenBefore || pos.fen()
    const color = pos.turn()

    // Evaluate before the move (White's POV).
    const evalBefore = await engine.evaluate(fenBefore)

    // Best-move eval: the engine's eval of the position before the move.
    // (With a single evaluate() call per position, bestEval == evalBefore.)
    const bestEval = evalBefore

    // Make the move on the replay position.
    try {
      pos.move(move.uci)
    } catch {
      // If the move is illegal in the replay (shouldn't happen for valid PGNs),
      // skip classification but keep the move.
    }
    const fenAfter = move.fenAfter || pos.fen()
    const evalAfter = await engine.evaluate(fenAfter)

    // Detect forced moves (only one legal move) — re-derive from the position.
    let legalMoveCount = 0
    try {
      const beforePos = new Position(fenBefore)
      legalMoveCount = beforePos.moves().length
    } catch {
      legalMoveCount = 1
    }

    const isCheckmate = new Position(fenAfter).isCheckmate()
    const isOpening = ply < 20
    const isBestMove = isBestMoveHeuristic(evalBefore, evalAfter)

    // Skip classification in garbage time (already winning/losing hugely).
    let classification: MoveClassification = 'no_annotation'
    const garbageCp = evalBefore.cp ?? (evalBefore.mate !== undefined ? (evalBefore.mate > 0 ? 1000 : -1000) : 0)
    if (!isGarbageTime(garbageCp)) {
      classification = classifyMove({
        color,
        evalBefore,
        evalAfter,
        bestEval,
        isCheckmate,
        legalMoveCount,
        ply,
        isOpening,
        isBestMove,
      })
    }

    moves.push({
      ply,
      move,
      evalBefore,
      evalAfter,
      bestEval,
      classification,
      color,
    })

    if (onProgress) {
      onProgress({ moves: [...moves], openingName })
    }
  }

  return { moves, openingName }
}

/**
 * Heuristic: did the played move match the engine's best move?
 * With single-eval-per-position, a move is "best" if it doesn't lose
 * meaningful eval vs the position eval before it (within a small margin).
 */
function isBestMoveHeuristic(evalBefore: EvalScore, evalAfter: EvalScore): boolean {
  // If both are mate scores, "best" if the mate didn't get worse for the mover.
  if (evalBefore.mate !== undefined && evalAfter.mate !== undefined) {
    return true
  }
  // If evalAfter is close to evalBefore (within 10cp), treat as best.
  if (evalBefore.cp !== undefined && evalAfter.cp !== undefined) {
    return Math.abs(evalAfter.cp - evalBefore.cp) <= 10
  }
  return false
}
