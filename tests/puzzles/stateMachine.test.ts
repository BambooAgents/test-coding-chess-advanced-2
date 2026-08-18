import { describe, it, expect, beforeEach } from 'vitest'
import {
  createSession,
  startPuzzle,
  tryMove,
  getUserColor,
  type PuzzleSessionState,
} from '../../src/puzzles/stateMachine'
import type { Puzzle } from '../../src/puzzles/types'

// A real puzzle: "White to move" — a simple back-rank mate setup
// FEN: white to move, plays Ra8# (mate)
// This is a constructed test puzzle, not from lichess DB
const testPuzzle: Puzzle = {
  id: 'test1',
  // Position where white plays Re8# — but let's use a known-valid puzzle
  // Simpler: just a position where white has one correct move
  fen: 'r1bqk1nr/pppp1Bpp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 4',
  // After the FEN position, it's Black's move (b in FEN).
  // But wait — lichess puzzles: first move is the opponent's (setup) move,
  // and the FEN is BEFORE that move. So moves[0] is the setup move.
  // For this test, we need a puzzle where the user is to move.
  // Let me construct it differently:
  moves: ['e8g8', 'f1f3'], // not realistic, just testing the mechanics
  rating: 1500,
  ratingDeviation: 80,
  popularity: 100,
  nbPlays: 5000,
  themes: ['opening'],
  openingTags: [],
  gameUrl: '',
}

// A simpler puzzle: white to move, correct move is e2e4
const simplePuzzle: Puzzle = {
  id: 'simple1',
  // Standard starting position — white to move
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e2e4', 'e7e5'], // user plays e2e4, opponent replies e7e5
  rating: 800,
  ratingDeviation: 100,
  popularity: 50,
  nbPlays: 10000,
  themes: ['opening'],
  openingTags: [],
  gameUrl: '',
}

describe('createSession', () => {
  it('creates a fresh session with idle state', () => {
    const session = createSession()
    expect(session.state).toBe('idle')
    expect(session.puzzle).toBeNull()
    expect(session.stats.streak).toBe(0)
    expect(session.stats.solved).toBe(0)
  })
})

describe('getUserColor', () => {
  it('returns white for white-to-move FEN', () => {
    expect(getUserColor('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe('white')
  })

  it('returns black for black-to-move FEN', () => {
    expect(getUserColor('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).toBe('black')
  })
})

describe('startPuzzle', () => {
  it('loads a puzzle and sets state to playing', () => {
    const session = createSession()
    const newSession = startPuzzle(session, simplePuzzle)
    expect(newSession.state).toBe('playing')
    expect(newSession.puzzle).toBe(simplePuzzle)
    expect(newSession.currentFen).toBe(simplePuzzle.fen)
    expect(newSession.userColor).toBe('white')
    expect(newSession.moveIndex).toBe(0)
  })

  it('detects black to move', () => {
    const session = createSession()
    const blackPuzzle: Puzzle = {
      ...simplePuzzle,
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    }
    const newSession = startPuzzle(session, blackPuzzle)
    expect(newSession.userColor).toBe('black')
  })
})

describe('tryMove — correct moves', () => {
  it('accepts the correct first move', () => {
    const session = createSession()
    const playing = startPuzzle(session, simplePuzzle)
    // moves[0] = 'e2e4' — that's the user's first move in this puzzle
    const result = tryMove(playing, 'e2e4')
    expect(result.correct).toBe(true)
    // After e2e4, opponent auto-plays e7e5 (moves[1])
    // Then the puzzle has no more moves → solved
    expect(result.session.state).toBe('solved')
    expect(result.session.stats.solved).toBe(1)
    expect(result.session.stats.streak).toBe(1)
  })

  it('auto-plays opponent reply and continues if more moves expected', () => {
    const session = createSession()
    // Puzzle with 4 moves: user, opponent, user, opponent
    const longPuzzle: Puzzle = {
      id: 'long1',
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
    const playing = startPuzzle(session, longPuzzle)
    // User plays e2e4 (moves[0])
    const r1 = tryMove(playing, 'e2e4')
    expect(r1.correct).toBe(true)
    // After e2e4, opponent auto-plays e7e5 (moves[1])
    // Now it's user's turn again, expecting g1f3 (moves[2])
    expect(r1.session.state).toBe('playing')
    expect(r1.session.moveIndex).toBe(2) // next expected is moves[2] wait
    // moveIndex after playing moves[0] and auto-playing moves[1]:
    // we played index 0, then opponent at index 1, so next user move is index 2
    // moveIndex = 2 + 1 = 3? Let me check the logic...
    // Actually: moveIndex starts at 0. User plays moves[0], correct.
    // nextIndex = 0 + 1 = 1. opponentMove = moves[1]. Play it. newFen.
    // remainingMoves = moves.length - (1 + 1) = 4 - 2 = 2. > 0, so continue.
    // moveIndex = 1 + 1 = 2... wait, the code says moveIndex: nextIndex + 1 = 2.
    // Hmm, let me re-check: the code sets moveIndex: nextIndex + 1 = 1 + 1 = 2.
    // So next expected move is moves[2] = 'g1f3'. That's correct!

    // User plays g1f3 (moves[2])
    const r2 = tryMove(r1.session, 'g1f3')
    expect(r2.correct).toBe(true)
    // After g1f3, opponent auto-plays b8c6 (moves[3])
    // remainingMoves = 4 - (3+1) = 0 → solved!
    expect(r2.session.state).toBe('solved')
    expect(r2.session.stats.solved).toBe(1)
  })
})

describe('tryMove — wrong moves', () => {
  it('rejects a wrong move and sets failed state', () => {
    const session = createSession()
    const playing = startPuzzle(session, simplePuzzle)
    // Play d2d4 instead of the correct e2e4
    const result = tryMove(playing, 'd2d4')
    expect(result.correct).toBe(false)
    expect(result.session.state).toBe('failed')
    expect(result.session.stats.failed).toBe(1)
    expect(result.session.stats.streak).toBe(0)
  })
})

describe('tryMove — edge cases', () => {
  it('does nothing when state is idle', () => {
    const session = createSession()
    const result = tryMove(session, 'e2e4')
    expect(result.correct).toBe(false)
    expect(result.session.state).toBe('idle')
  })

  it('does nothing when state is solved', () => {
    const session = createSession()
    const playing = startPuzzle(session, simplePuzzle)
    const solved = tryMove(playing, 'e2e4').session
    expect(solved.state).toBe('solved')
    const result = tryMove(solved, 'e2e4')
    expect(result.correct).toBe(false)
  })
})

describe('stats tracking', () => {
  it('increments streak on solve', () => {
    let session = createSession()
    session = startPuzzle(session, simplePuzzle)
    session = tryMove(session, 'e2e4').session
    expect(session.stats.streak).toBe(1)
    expect(session.stats.bestStreak).toBe(1)
  })

  it('resets streak on fail', () => {
    let session: PuzzleSessionState = createSession()
    session = { ...session, stats: { streak: 5, bestStreak: 5, solved: 5, failed: 0 } }
    session = startPuzzle(session, simplePuzzle)
    session = tryMove(session, 'd2d4').session
    expect(session.stats.streak).toBe(0)
    expect(session.stats.bestStreak).toBe(5)
    expect(session.stats.failed).toBe(1)
  })
})
