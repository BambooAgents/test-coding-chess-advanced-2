import { describe, it, expect } from 'vitest'
import {
  createRushSession,
  startRush,
  rushCorrect,
  rushWrong,
  rushTick,
  RUSH_MAX_WRONG,
  createDeathMatchSession,
  startDeathMatch,
  dmCorrect,
  dmWrong,
  pickNextPuzzle,
} from '../../src/puzzles/modes'
import type { Puzzle } from '../../src/puzzles/types'

function makePuzzle(id: string, rating: number): Puzzle {
  return {
    id, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: ['e2e4', 'e7e5'], rating, ratingDeviation: 80, popularity: 0,
    nbPlays: 0, themes: [], openingTags: [], gameUrl: '',
  }
}

describe('Rush mode', () => {
  it('creates a fresh session with 180s and 0 wrong/solved', () => {
    const s = createRushSession()
    expect(s.state).toBe('idle')
    expect(s.timeLeft).toBe(180)
    expect(s.wrongCount).toBe(0)
    expect(s.solved).toBe(0)
    expect(s.lastResult).toBeNull()
  })

  it('starts in playing state with a custom time limit', () => {
    const s = startRush(120)
    expect(s.state).toBe('playing')
    expect(s.timeLeft).toBe(120)
  })

  it('records a correct solve and increments score', () => {
    const s = startRush()
    const s2 = rushCorrect(s)
    expect(s2.solved).toBe(1)
    expect(s2.lastResult).toBe('correct')
  })

  it('escalates the rating floor every 5 solves', () => {
    let s = startRush()
    for (let i = 0; i < 5; i++) s = rushCorrect(s)
    expect(s.solved).toBe(5)
    expect(s.ratingFloor).toBe(1300) // 1200 + 100
  })

  it('does not escalate before 5 solves', () => {
    let s = startRush()
    for (let i = 0; i < 4; i++) s = rushCorrect(s)
    expect(s.ratingFloor).toBe(1200)
  })

  it('records a wrong answer; 3 wrong finishes', () => {
    let s = startRush()
    s = rushWrong(s)
    expect(s.wrongCount).toBe(1)
    expect(s.state).toBe('playing')
    s = rushWrong(s)
    expect(s.wrongCount).toBe(2)
    expect(s.state).toBe('playing')
    s = rushWrong(s)
    expect(s.wrongCount).toBe(3)
    expect(s.state).toBe('finished')
  })

  it('RUSH_MAX_WRONG is 3', () => {
    expect(RUSH_MAX_WRONG).toBe(3)
  })

  it('ticks the timer and finishes at 0', () => {
    let s = startRush(5)
    s = rushTick(s, 3)
    expect(s.timeLeft).toBe(2)
    expect(s.state).toBe('playing')
    s = rushTick(s, 3)
    expect(s.timeLeft).toBe(0)
    expect(s.state).toBe('finished')
  })

  it('tick does nothing when not playing', () => {
    const s = createRushSession()
    const s2 = rushTick(s, 10)
    expect(s2).toEqual(s)
  })
})

describe('Death-Match mode', () => {
  it('creates a fresh session with 3 lives', () => {
    const s = createDeathMatchSession()
    expect(s.state).toBe('idle')
    expect(s.lives).toBe(3)
    expect(s.inARow).toBe(0)
    expect(s.solved).toBe(0)
  })

  it('starts in playing state', () => {
    const s = startDeathMatch()
    expect(s.state).toBe('playing')
  })

  it('records a correct solve and increments in-a-row', () => {
    const s = startDeathMatch()
    const s2 = dmCorrect(s)
    expect(s2.solved).toBe(1)
    expect(s2.inARow).toBe(1)
    expect(s2.lastResult).toBe('correct')
  })

  it('grants +1 life per 5-in-a-row', () => {
    let s = startDeathMatch()
    for (let i = 0; i < 5; i++) s = dmCorrect(s)
    expect(s.inARow).toBe(5)
    expect(s.lives).toBe(4) // 3 + 1 bonus
  })

  it('does not grant a bonus before 5-in-a-row', () => {
    let s = startDeathMatch()
    for (let i = 0; i < 4; i++) s = dmCorrect(s)
    expect(s.lives).toBe(3)
  })

  it('grants +1 life again at 10-in-a-row', () => {
    let s = startDeathMatch()
    for (let i = 0; i < 10; i++) s = dmCorrect(s)
    expect(s.inARow).toBe(10)
    expect(s.lives).toBe(5) // 3 + 2 bonuses
  })

  it('records a wrong answer: -1 life, resets in-a-row', () => {
    let s = startDeathMatch()
    s = dmCorrect(s)
    s = dmCorrect(s)
    expect(s.inARow).toBe(2)
    s = dmWrong(s)
    expect(s.lives).toBe(2) // 3 - 1
    expect(s.inARow).toBe(0)
    expect(s.lastResult).toBe('wrong')
  })

  it('finishes when lives hit 0', () => {
    let s = startDeathMatch()
    s = dmWrong(s) // lives 2
    expect(s.state).toBe('playing')
    s = dmWrong(s) // lives 1
    expect(s.state).toBe('playing')
    s = dmWrong(s) // lives 0
    expect(s.state).toBe('finished')
  })

  it('escalates the rating floor every 5 solves', () => {
    let s = startDeathMatch()
    for (let i = 0; i < 5; i++) s = dmCorrect(s)
    expect(s.ratingFloor).toBe(1300)
  })
})

describe('pickNextPuzzle', () => {
  it('returns null for an empty pool', () => {
    expect(pickNextPuzzle([], 1200, new Set())).toBeNull()
  })

  it('prefers puzzles at or above the rating floor', () => {
    const pool = [makePuzzle('a', 1000), makePuzzle('b', 1500), makePuzzle('c', 2000)]
    const picked = pickNextPuzzle(pool, 1400, new Set())
    expect(picked).not.toBeNull()
    expect(picked!.rating).toBeGreaterThanOrEqual(1400)
  })

  it('excludes seen puzzle ids', () => {
    const pool = [makePuzzle('a', 1500), makePuzzle('b', 1500)]
    const picked = pickNextPuzzle(pool, 1200, new Set(['a']))
    expect(picked).not.toBeNull()
    expect(picked!.id).toBe('b')
  })

  it('falls back to any puzzle when all eligible are excluded', () => {
    const pool = [makePuzzle('a', 1500)]
    const picked = pickNextPuzzle(pool, 1200, new Set(['a']))
    expect(picked).not.toBeNull() // repeats
  })
})
