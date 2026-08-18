/**
 * Winning-chances math — converting engine evaluations to a 0..1 win-probability.
 *
 * Implements the lichess winning-chances formula and helpers, per
 * `docs/spec/annotation-thresholds.md` §1.
 */

import type { Color, EvalScore } from './types'

const MULTIPLIER = -0.00368208

/**
 * Convert centipawns to winning chances on a [-1, +1] scale.
 * +1 = infinitely winning, -1 = infinitely losing.
 * cp is clamped to [-1000, 1000] before computing.
 */
export function winningChances(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp))
  return (2 / (1 + Math.exp(MULTIPLIER * clamped))) - 1
}

/**
 * Convert a mate score to winning chances on a [-1, +1] scale.
 * mate > 0 = White mates, mate < 0 = Black mates.
 */
export function mateWinningChances(mate: number): number {
  const cp = (21 - Math.min(10, Math.abs(mate))) * 100
  const signed = cp * (mate > 0 ? 1 : -1)
  return winningChances(signed)
}

/**
 * Convert any EvalScore to winning chances on a [-1, +1] scale (White's POV).
 */
export function evalWinningChances(ev: EvalScore): number {
  if (ev.mate !== undefined) {
    return mateWinningChances(ev.mate)
  }
  if (ev.cp !== undefined) {
    return winningChances(ev.cp)
  }
  return 0 // unknown eval → neutral
}

/**
 * Convert an EvalScore to winning chances from a specific player's perspective.
 * White's perspective: winningChances as-is.
 * Black's perspective: negate.
 */
export function povChances(color: Color, ev: EvalScore): number {
  return color === 'white' ? evalWinningChances(ev) : -evalWinningChances(ev)
}

/**
 * Compute the winning-chance delta caused by a move, from the player's perspective.
 * Negative delta = the move worsened the player's position.
 * Positive delta = the move improved the player's position.
 *
 * e1 = eval before the move, e2 = eval after the move, color = mover's color.
 *
 * Note: the lichess formula computes (povChances(before) - povChances(after)) / 2
 * which gives a POSITIVE value when the position worsens (before > after).
 * We negate it so that negative = worse, matching the spec's threshold checks
 * (delta <= -0.30 → blunder). This is the sign convention used by the spec's
 * decision tree (§5) and threshold table (§2.1).
 */
export function povDiff(color: Color, e1: EvalScore, e2: EvalScore): number {
  return (povChances(color, e2) - povChances(color, e1)) / 2
}

/**
 * Convert centipawns to a win-percentage on a [0, 100] scale.
 */
export function winPercent(cp: number): number {
  return 50 + 50 * winningChances(Math.max(-1000, Math.min(1000, cp)))
}

/**
 * Convert an EvalScore to a win-percentage on a [0, 100] scale (White's POV).
 */
export function evalToWinPercent(ev: EvalScore): number {
  if (ev.mate !== undefined) {
    const chances = mateWinningChances(ev.mate)
    return 50 + 50 * chances
  }
  if (ev.cp !== undefined) {
    return winPercent(ev.cp)
  }
  return 50
}

/**
 * Compute win-percentage from a specific player's perspective.
 */
export function povWinPercent(color: Color, ev: EvalScore): number {
  return color === 'white' ? evalToWinPercent(ev) : 100 - evalToWinPercent(ev)
}

/**
 * Compute per-move accuracy using lichess's accuracy formula.
 * before, after: win percentages on 0-100 scale (from either perspective).
 */
export function accuracyFromWinPercents(before: number, after: number): number {
  if (after >= before) return 100
  const winDiff = before - after
  const raw =
    103.1668100711649 * Math.exp(-0.04354415386753951 * winDiff) -
    3.166924740191411
  return Math.min(100, Math.max(0, raw + 1))
}
