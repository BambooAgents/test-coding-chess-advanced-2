/**
 * Puzzle Rush + Death-Match mode state machines.
 *
 * Rush: timed (default 3 minutes), 3 wrong = out, escalating difficulty,
 *   score = count solved. Skip wrong puzzles (don't block).
 *
 * Death-Match: experimental/prototype — +1 life per 5-in-a-row correct,
 *   -1 life per wrong, endless-ish, increasing difficulty. Start with 3 lives.
 *
 * Both modes reuse the puzzle bundle + board. Difficulty escalates by
 * filtering puzzles to a rating band that rises as the score grows.
 */

import type { Puzzle } from './types'

export type RushState = 'idle' | 'playing' | 'finished'

export interface RushSession {
  state: RushState
  /** Seconds remaining (rush) — null when not timed. */
  timeLeft: number
  /** Wrong answers so far (3 = out). */
  wrongCount: number
  /** Number solved. */
  solved: number
  /** Current puzzle. */
  currentPuzzle: Puzzle | null
  /** Whether the current puzzle was skipped (wrong) — for UI feedback. */
  lastResult: 'correct' | 'wrong' | null
  /** The rating floor (escalates with score). */
  ratingFloor: number
}

/** Create a fresh rush session. */
export function createRushSession(): RushSession {
  return {
    state: 'idle',
    timeLeft: 180,
    wrongCount: 0,
    solved: 0,
    currentPuzzle: null,
    lastResult: null,
    ratingFloor: 1200,
  }
}

/** Start a rush session with a given time limit (seconds). */
export function startRush(timeLimit = 180): RushSession {
  return { ...createRushSession(), state: 'playing', timeLeft: timeLimit }
}

/** The max wrong answers before rush ends. */
export const RUSH_MAX_WRONG = 3

/**
 * Record a correct solve in rush mode. Escalates difficulty every 5 solves.
 */
export function rushCorrect(session: RushSession): RushSession {
  const newSolved = session.solved + 1
  // Escalate the rating floor by 100 every 5 solves.
  const ratingFloor = session.ratingFloor + (newSolved % 5 === 0 ? 100 : 0)
  return {
    ...session,
    solved: newSolved,
    lastResult: 'correct',
    ratingFloor,
    currentPuzzle: null, // clear; caller loads the next puzzle
  }
}

/**
 * Record a wrong answer in rush mode. 3 wrong = finished.
 */
export function rushWrong(session: RushSession): RushSession {
  const wrongCount = session.wrongCount + 1
  const finished = wrongCount >= RUSH_MAX_WRONG
  return {
    ...session,
    wrongCount,
    lastResult: 'wrong',
    state: finished ? 'finished' : session.state,
    currentPuzzle: null,
  }
}

/**
 * Tick the rush timer. Returns the updated session; when time hits 0,
 * the session finishes.
 */
export function rushTick(session: RushSession, deltaSeconds = 1): RushSession {
  if (session.state !== 'playing') return session
  const timeLeft = Math.max(0, session.timeLeft - deltaSeconds)
  return {
    ...session,
    timeLeft,
    state: timeLeft <= 0 ? 'finished' : session.state,
  }
}

export type DeathMatchState = 'idle' | 'playing' | 'finished'

export interface DeathMatchSession {
  state: DeathMatchState
  /** Lives remaining. Start at 3. +1 per 5-in-a-row, -1 per wrong. 0 = finished. */
  lives: number
  /** Current in-a-row streak (resets to 0 on wrong). */
  inARow: number
  /** Total solved. */
  solved: number
  /** Current puzzle. */
  currentPuzzle: Puzzle | null
  lastResult: 'correct' | 'wrong' | null
  /** The rating floor (escalates with score). */
  ratingFloor: number
}

/** Create a fresh death-match session. */
export function createDeathMatchSession(): DeathMatchSession {
  return {
    state: 'idle',
    lives: 3,
    inARow: 0,
    solved: 0,
    currentPuzzle: null,
    lastResult: null,
    ratingFloor: 1200,
  }
}

/** Start a death-match session. */
export function startDeathMatch(): DeathMatchSession {
  return { ...createDeathMatchSession(), state: 'playing' }
}

/**
 * Record a correct solve in death-match. +1 life per 5-in-a-row;
 * escalates difficulty every 5 solves.
 */
export function dmCorrect(session: DeathMatchSession): DeathMatchSession {
  const newSolved = session.solved + 1
  const newInARow = session.inARow + 1
  // +1 life per 5-in-a-row correct.
  const bonusLife = newInARow > 0 && newInARow % 5 === 0 ? 1 : 0
  const lives = session.lives + bonusLife
  const ratingFloor = session.ratingFloor + (newSolved % 5 === 0 ? 100 : 0)
  return {
    ...session,
    solved: newSolved,
    inARow: newInARow,
    lives,
    lastResult: 'correct',
    ratingFloor,
    currentPuzzle: null,
  }
}

/**
 * Record a wrong answer in death-match. -1 life, reset in-a-row. 0 lives = finished.
 */
export function dmWrong(session: DeathMatchSession): DeathMatchSession {
  const lives = session.lives - 1
  return {
    ...session,
    lives,
    inARow: 0,
    lastResult: 'wrong',
    state: lives <= 0 ? 'finished' : session.state,
    currentPuzzle: null,
  }
}

/**
 * Pick the next puzzle for a mode, respecting the escalating rating floor.
 * Returns a puzzle with rating >= floor (or the closest available if none).
 */
export function pickNextPuzzle(
  pool: Puzzle[],
  ratingFloor: number,
  excludeIds: Set<string>,
): Puzzle | null {
  if (pool.length === 0) return null
  // Prefer puzzles at or above the floor that haven't been seen.
  const eligible = pool.filter((p) => p.rating >= ratingFloor && !excludeIds.has(p.id))
  if (eligible.length > 0) {
    return eligible[Math.floor(Math.random() * eligible.length)]
  }
  // Fall back to any unseen puzzle.
  const unseen = pool.filter((p) => !excludeIds.has(p.id))
  if (unseen.length > 0) {
    return unseen[Math.floor(Math.random() * unseen.length)]
  }
  // Fall back to any puzzle (repeat allowed).
  return pool[Math.floor(Math.random() * pool.length)]
}
