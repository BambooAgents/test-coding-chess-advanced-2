/**
 * Move classification — implements the 6 eval-delta badges per
 * `docs/spec/annotation-thresholds.md` §2 and §5 (decision tree).
 *
 * Brilliant (??) is NOT implemented here — that's ticket #15.
 */

import type {
  Color,
  ClassifyMoveInput,
  MoveClassification,
} from './types'
import {
  evalToWinPercent,
  povDiff,
} from './winningChances'
import { isGarbageTime } from './phase'

/** Winning-chance delta thresholds (lichess-based, negative classifications). */
const DELTA_BLUNDER = -0.30
const DELTA_MISTAKE = -0.20
const DELTA_INACCURACY = -0.10

/** Win-probability loss thresholds (Chess Review Engine, positive classifications). */
const WINLOSS_BEST = 2.5
const WINLOSS_GOOD = 8.0
const WINLOSS_BOOK = 2.0
const BOOK_CP_LOSS = 20

/** Opening phase: ply ≤ 20. */
// const OPENING_PLY_LIMIT = 20

/**
 * Detect a mate-sequence transition between two evals.
 * Returns one of: 'mate_created', 'mate_lost', 'mate_delayed', null.
 */
/**
 * Detect a mate-sequence transition between two evals.
 * Mate scores are from White's perspective (positive = White mates, negative = Black mates).
 * The mover's color determines which sign means "mating the opponent."
 * Returns one of: 'mate_created', 'mate_lost', 'mate_delayed', null.
 */
function detectMateSequence(
  evalBefore: { cp?: number; mate?: number },
  evalAfter: { cp?: number; mate?: number },
  color: Color,
): 'mate_created' | 'mate_lost' | 'mate_delayed' | null {
  const beforeHasMate = evalBefore.mate !== undefined
  const afterHasMate = evalAfter.mate !== undefined

  // For a White mover, mate > 0 means White is mating (good).
  // For a Black mover, mate < 0 means Black is mating (good).
  const moverMate = (mate: number) => color === 'white' ? mate > 0 : mate < 0

  // MateCreated: eval was cp, now mate in mover's favour
  if (!beforeHasMate && afterHasMate && moverMate(evalAfter.mate!)) {
    return 'mate_created'
  }

  // MateLost: eval was mate (mover mating), now cp
  if (beforeHasMate && moverMate(evalBefore.mate!) && !afterHasMate) {
    return 'mate_lost'
  }

  // MateDelayed: was mate (mover mating), now mate (mover mating) but slower
  if (
    beforeHasMate &&
    afterHasMate &&
    moverMate(evalBefore.mate!) &&
    moverMate(evalAfter.mate!) &&
    Math.abs(evalAfter.mate!) > Math.abs(evalBefore.mate!)
  ) {
    return 'mate_delayed'
  }

  return null
}

/**
 * Classify a move based on eval-delta thresholds.
 *
 * Implements the full decision tree from `docs/spec/annotation-thresholds.md` §5.
 *
 * @returns A MoveClassification value.
 */
export function classifyMove(input: ClassifyMoveInput): MoveClassification {
  const {
    color,
    evalBefore,
    evalAfter,
    bestEval,
    isCheckmate,
    legalMoveCount,
    isBestMove,
    isOpening,
    prevOwnClassification,
    prevOppClassification,
  } = input

  // Step 1: Checkmate → BEST
  if (isCheckmate) return 'best'

  // Step 2: Only one legal move → BEST (forced move, no choice)
  if (legalMoveCount === 1) return 'best'

  // Step 3: Garbage time → skip annotation
  const bestCp = bestEval.cp ?? 0
  if (bestEval.cp !== undefined && isGarbageTime(bestCp)) {
    return 'no_annotation'
  }
  // Also skip if mate score (already won/lost)
  if (bestEval.mate !== undefined && Math.abs(bestEval.mate) <= 2) {
    return 'no_annotation'
  }

  // Step 4: Compute winning-chance delta
  const delta = povDiff(color, evalBefore, evalAfter)

  // Step 5: Handle mate sequences
  const mateSeq = detectMateSequence(evalBefore, evalAfter, color)
  if (mateSeq === 'mate_created') {
    return 'best'
  }
  if (mateSeq === 'mate_lost') {
    // Lost forced mate — classify based on resulting cp delta
    // The delta already captures this since we went from mate to cp
    if (delta <= DELTA_BLUNDER) return 'blunder'
    if (delta <= DELTA_MISTAKE) return 'mistake'
    return 'inaccuracy'
  }
  if (mateSeq === 'mate_delayed') {
    // Slower mate — inaccuracy if distance increased by > 2, else good.
    // Use absolute values since mate scores are signed (positive = White, negative = Black).
    const mateBefore = Math.abs(evalBefore.mate ?? 0)
    const mateAfter = Math.abs(evalAfter.mate ?? 0)
    if (mateAfter - mateBefore > 2) return 'inaccuracy'
    return 'good'
  }

  // Step 6-8: Negative classifications (winning-chance delta)
  if (delta <= DELTA_BLUNDER) return 'blunder'
  if (delta <= DELTA_MISTAKE) return 'mistake'
  if (delta <= DELTA_INACCURACY) return 'inaccuracy'

  // Steps 9-15: Positive classifications (delta > -0.10)

  // Compute win-probability loss for positive classifications
  const bestWinPct = evalToWinPercent(bestEval)
  const playedWinPct = evalToWinPercent(evalAfter)
  // Win-loss from the mover's perspective
  const bestMoverWinPct = color === 'white' ? bestWinPct : 100 - bestWinPct
  const playedMoverWinPct = color === 'white' ? playedWinPct : 100 - playedWinPct
  const winLossPct = bestMoverWinPct - playedMoverWinPct

  // Compute centipawn loss for book detection
  const bestCpValue = bestEval.cp ?? 0
  const playedCpValue = evalAfter.cp ?? 0
  const cpLoss = Math.abs(bestCpValue - playedCpValue)

  // Step 10: Book detection (eval-match fallback, no opening book bundled)
  if (isOpening && winLossPct <= WINLOSS_BOOK && cpLoss <= BOOK_CP_LOSS) {
    return 'book'
  }

  // Step 11: Best move with Great detection
  if (isBestMove) {
    const isGreat =
      !isOpening &&
      (prevOwnClassification === 'great' ||
        prevOppClassification === 'inaccuracy' ||
        prevOppClassification === 'mistake' ||
        prevOppClassification === 'blunder')
    if (isGreat) return 'great'
    return 'best'
  }

  // Step 12: Very close to best (win-prob loss ≤ 2.5%)
  if (winLossPct <= WINLOSS_BEST) return 'best'

  // Step 13: Good (win-prob loss 2.5–8%)
  if (winLossPct <= WINLOSS_GOOD) return 'good'

  // Step 14-15: Fallback — between good and inaccuracy
  return 'inaccuracy'
}
