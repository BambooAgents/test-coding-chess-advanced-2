import { describe, it, expect } from 'vitest'
import {
  createSession,
  startPuzzle,
  tryMove,
  stepSolution,
  getSolutionSan,
  formatSolutionSan,
} from '../../src/puzzles/stateMachine'
import type { Puzzle } from '../../src/puzzles/types'

// A puzzle where white to move: e4, opponent e5, Nf3, opponent Nc6
const longPuzzle: Puzzle = {
  id: 'test-long',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
  rating: 1200,
  ratingDeviation: 100,
  popularity: 80,
  nbPlays: 5000,
  themes: ['opening'],
  openingTags: [],
  gameUrl: '',
}

// A puzzle where black to move
const blackToMovePuzzle: Puzzle = {
  id: 'test-black',
  fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
  moves: ['e7e5', 'g1f3', 'b8c6'],
  rating: 1000,
  ratingDeviation: 100,
  popularity: 70,
  nbPlays: 3000,
  themes: ['opening'],
  openingTags: [],
  gameUrl: '',
}

describe('getSolutionSan', () => {
  it('converts all UCI moves to SAN', () => {
    const sans = getSolutionSan(longPuzzle)
    expect(sans).toEqual(['e4', 'e5', 'Nf3', 'Nc6'])
  })

  it('converts partial solution (upToStep)', () => {
    const sans = getSolutionSan(longPuzzle, 2)
    expect(sans).toEqual(['e4', 'e5'])
  })

  it('handles empty solution', () => {
    const emptyPuzzle: Puzzle = { ...longPuzzle, moves: [] }
    expect(getSolutionSan(emptyPuzzle)).toEqual([])
  })

  it('handles black-to-move puzzle', () => {
    const sans = getSolutionSan(blackToMovePuzzle)
    expect(sans).toEqual(['e5', 'Nf3', 'Nc6'])
  })
})

describe('formatSolutionSan', () => {
  it('formats white-to-move solution as numbered move pairs', () => {
    const formatted = formatSolutionSan(longPuzzle)
    expect(formatted).toBe('1. e4 e5 2. Nf3 Nc6')
  })

  it('formats partial solution', () => {
    const formatted = formatSolutionSan(longPuzzle, 2)
    expect(formatted).toBe('1. e4 e5')
  })

  it('formats black-to-move solution with ... prefix', () => {
    const formatted = formatSolutionSan(blackToMovePuzzle)
    expect(formatted).toBe('1... e5 2. Nf3 Nc6')
  })

  it('formats odd-length solution (white ends)', () => {
    const oddPuzzle: Puzzle = { ...longPuzzle, moves: ['e2e4', 'e7e5', 'g1f3'] }
    const formatted = formatSolutionSan(oddPuzzle)
    expect(formatted).toBe('1. e4 e5 2. Nf3')
  })

  it('formats single-move solution', () => {
    const singlePuzzle: Puzzle = { ...longPuzzle, moves: ['e2e4'] }
    const formatted = formatSolutionSan(singlePuzzle)
    expect(formatted).toBe('1. e4')
  })

  it('returns empty string for empty solution', () => {
    const emptyPuzzle: Puzzle = { ...longPuzzle, moves: [] }
    expect(formatSolutionSan(emptyPuzzle)).toBe('')
  })
})

describe('stepSolution + solution display integration', () => {
  it('shows full solution when solutionStep is 0 (failed state)', () => {
    const session = createSession()
    const playing = startPuzzle(session, longPuzzle)
    const failed = tryMove(playing, 'd2d4') // wrong move → failed
    expect(failed.session.state).toBe('failed')
    expect(failed.session.solutionStep).toBe(0)
    // When solutionStep is 0, formatSolutionSan should show the full solution
    const full = formatSolutionSan(failed.session.puzzle!, failed.session.puzzle!.moves.length)
    expect(full).toBe('1. e4 e5 2. Nf3 Nc6')
  })

  it('shows progressive solution as steps advance', () => {
    const session = createSession()
    const playing = startPuzzle(session, longPuzzle)
    // Click "Show Solution" → step 1 (first move only)
    const step1 = stepSolution(playing)
    expect(step1.showSolution).toBe(true)
    expect(step1.solutionStep).toBe(1)
    const partial1 = formatSolutionSan(step1.puzzle!, step1.solutionStep)
    expect(partial1).toBe('1. e4')
    // Click "Next Move →" → step 2
    const step2 = stepSolution(step1)
    expect(step2.solutionStep).toBe(2)
    const partial2 = formatSolutionSan(step2.puzzle!, step2.solutionStep)
    expect(partial2).toBe('1. e4 e5')
    // Step 3
    const step3 = stepSolution(step2)
    const partial3 = formatSolutionSan(step3.puzzle!, step3.solutionStep)
    expect(partial3).toBe('1. e4 e5 2. Nf3')
    // Step 4 = full solution
    const step4 = stepSolution(step3)
    const partial4 = formatSolutionSan(step4.puzzle!, step4.solutionStep)
    expect(partial4).toBe('1. e4 e5 2. Nf3 Nc6')
  })
})
