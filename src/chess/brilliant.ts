/**
 * Brilliant (??) move classification — heuristic approximation per
 * `docs/spec/brilliant-heuristic.md`.
 *
 * This is a precision-favoring approximation of chess.com's proprietary
 * brilliant classification, synthesizing four OSS reverse-engineering efforts.
 *
 * Engine calls are abstracted behind a `BrilliantEngine` interface so the
 * pure decision logic can be unit-tested with a mock engine.
 */

import { Position } from './Position'
import { findHangingPieceBait } from './see'
import { winPercent } from './winningChances'
import type { Color, EvalScore } from './types'

/** Engine interface for the engine calls the brilliant heuristic needs. */
export interface BrilliantEngine {
  /** Best move (UCI) for a FEN. */
  bestMove(fen: string): Promise<string>
  /** MultiPV N=2 evals for a FEN, White's POV. Returns [pv1Cp, pv2Cp]. */
  multiPv2(fen: string): Promise<{ pv1: EvalScore; pv2: EvalScore }>
  /** Evaluate a FEN, White's POV. */
  evaluate(fen: string): Promise<EvalScore>
}

/** Default thresholds (calibrated, precision-favoring). */
export const BRILLIANT_THRESHOLDS = {
  seeThreshold: 1,        // opponent's min static profit for the bait
  netSacMin: 1,           // bait profit minus material the move captured
  poisonLossCp: 300,      // taker's loss (cp, their POV) for "poisoned"
  onlyMoveMarginCp: 150,  // how far ahead of 2nd-best (cp, mover POV)
  bystanderTakerMaxWinPct: 10, // bystander baits: taker's max win% after capturing
  minWinAfterPct: 40,     // mover's min win% after the move
} as const

/** Input to the brilliant classifier. */
export interface BrilliantInput {
  /** FEN before the move. */
  fenBefore: string
  /** The played move (UCI). */
  playedUci: string
  /** The played move (SAN). */
  playedSan: string
  /** The color of the mover. */
  mover: Color
  /** The FEN after the move (post-move board, for bait detection). */
  fenAfter: string
  /** Eval after the move, White's POV. */
  evalAfterMove: EvalScore
  /** Value of the piece the move itself captured (0 if none). */
  movedCapturedValue: number
  /** FEN before the opponent's prior move (for staleness check), or undefined. */
  fenBeforeOpponentPriorMove?: string
}

/**
 * Decide whether a move is Brilliant (??).
 *
 * Returns true if all rules pass. This is async because it needs engine
 * calls (bestmove, MultiPV, post-capture eval).
 */
export async function isBrilliant(
  input: BrilliantInput,
  engine: BrilliantEngine,
  thresholds = BRILLIANT_THRESHOLDS,
): Promise<boolean> {
  const { fenBefore, playedUci, mover, fenAfter, evalAfterMove, movedCapturedValue } = input

  // Rule 1: Must be the engine's top choice.
  const engineBest = await engine.bestMove(fenBefore)
  if (playedUci !== engineBest) return false

  // Rule 5 (cheap pre-filter): Non-obviousness.
  // Mate-in-1: if the move delivers checkmate, it's Best, not Brilliant.
  const postMove = new Position(fenAfter)
  if (postMove.isCheckmate()) return false

  // Rule 3: Position not already lost after the move.
  const moverCpAfter = toMoverPov(evalAfterMove, mover)
  if (winPercent(moverCpAfter) < thresholds.minWinAfterPct) return false

  // Rule 2: Find the hanging-piece bait.
  const bait = findHangingPieceBait(postMove)
  if (!bait) return false
  if (bait.profit < thresholds.seeThreshold) return false
  if (bait.profit - movedCapturedValue < thresholds.netSacMin) return false

  // Staleness check: the bait must be fresh (not already hanging before the
  // opponent's previous move). Only check if we have the prior FEN.
  if (input.fenBeforeOpponentPriorMove) {
    try {
      const beforePrior = new Position(input.fenBeforeOpponentPriorMove)
      // Make a null move (switch side to move) to see if the bait existed.
      const priorBait = findHangingPieceBait(beforePrior)
      if (priorBait && priorBait.square === bait.square) return false
    } catch {
      // If we can't construct the position, skip the staleness check.
    }
  }

  // Rule 4: Check the brilliance mechanism.
  const isSelfSacrifice = bait.square === playedUci.slice(2, 4)

  // Mechanism A: Poisoned bait.
  // Compute the eval after the opponent captures the bait.
  const oppColor: Color = mover === 'white' ? 'black' : 'white'
  let evalAfterCapture: EvalScore | null = null
  try {
    // Find the opponent's best capture on the bait square.
    const captureUci = findCaptureTo(postMove, bait.square)
    if (captureUci) {
      const capturePos = new Position(fenAfter)
      capturePos.move(captureUci)
      evalAfterCapture = await engine.evaluate(capturePos.fen())
    }
  } catch {
    evalAfterCapture = null
  }

  if (evalAfterCapture) {
    const evalAfterMoveCp = evalToCp(evalAfterMove)
    const evalAfterCaptureCp = evalToCp(evalAfterCapture)
    // Taker's loss: from the taker's (opponent's) POV.
    // evalAfterMoveCp is White's POV; the taker is oppColor.
    // takerSign = +1 if taker is white, -1 if taker is black.
    const takerSign = oppColor === 'white' ? 1 : -1
    const takerLoss = (takerSign * evalAfterMoveCp) - (takerSign * evalAfterCaptureCp)
    if (takerLoss >= thresholds.poisonLossCp) return true
  }

  // Mechanism B: Only move.
  const multiPv = await engine.multiPv2(fenBefore)
  const pv1Cp = evalToCp(multiPv.pv1)
  const pv2Cp = evalToCp(multiPv.pv2)
  const moverSign = mover === 'white' ? 1 : -1
  const onlyMoveMargin = moverSign * (pv1Cp - pv2Cp)
  const isOnlyMove = onlyMoveMargin >= thresholds.onlyMoveMarginCp

  if (isSelfSacrifice && isOnlyMove) return true

  if (!isSelfSacrifice && isOnlyMove && evalAfterCapture) {
    // Bystander bait: capture must be decisive for the taker.
    const takerWinCp = oppColor === 'white' ? evalToCp(evalAfterCapture) : -evalToCp(evalAfterCapture)
    if (winPercent(takerWinCp) <= thresholds.bystanderTakerMaxWinPct) return true
  }

  return false
}

/** Convert an EvalScore to a centipawn value (White's POV), handling mate. */
function evalToCp(score: EvalScore): number {
  if (score.mate !== undefined) {
    return score.mate > 0 ? 100000 - Math.min(Math.abs(score.mate), 999) : -(100000 - Math.min(Math.abs(score.mate), 999))
  }
  return score.cp ?? 0
}

/** Convert a White-POV EvalScore to the mover's POV centipawns. */
function toMoverPov(score: EvalScore, mover: Color): number {
  const cp = evalToCp(score)
  return mover === 'white' ? cp : -cp
}

/** Find a UCI move that captures on `square` in the given position. */
function findCaptureTo(pos: Position, square: string): string | null {
  for (const m of pos.moves()) {
    if (m.to === square && (m.captured !== undefined || m.flags.includes('e'))) {
      return m.uci
    }
  }
  return null
}

/** Re-export for consumers. */
export { PIECE_VALUES } from './see'
