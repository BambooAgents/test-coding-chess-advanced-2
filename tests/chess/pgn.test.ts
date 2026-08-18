/**
 * Tests for PGN parsing and writing.
 */

import { describe, it, expect } from 'vitest'
import { parsePgn, parsePgnGames, writePgn } from '../../src/chess/pgn'

const SAMPLE_PGN = `[Event "Casual Game"]
[Site "chess.com"]
[Date "2024.01.15"]
[White "Alice"]
[Black "Bob"]
[Result "1-0"]
[Opening "Ruy Lopez"]
[ECO "C60"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 1-0`

describe('parsePgn', () => {
  it('parses headers', () => {
    const game = parsePgn(SAMPLE_PGN)
    expect(game.headers['Event']).toBe('Casual Game')
    expect(game.headers['White']).toBe('Alice')
    expect(game.headers['Black']).toBe('Bob')
    expect(game.headers['Result']).toBe('1-0')
    expect(game.headers['Opening']).toBe('Ruy Lopez')
    expect(game.headers['ECO']).toBe('C60')
  })

  it('parses moves with FEN before/after', () => {
    const game = parsePgn(SAMPLE_PGN)
    expect(game.moves.length).toBe(14) // 7 white moves + 7 black moves = 14 half-moves
    expect(game.moves[0].uci).toBe('e2e4')
    expect(game.moves[0].san).toBe('e4')
    expect(game.moves[0].fenBefore).toContain('rnbqkbnr/pppppppp')
    expect(game.moves[0].fenAfter).toContain('rnbqkbnr/pppppppp/8/8/4P3')
  })

  it('preserves the result', () => {
    const game = parsePgn(SAMPLE_PGN)
    expect(game.result).toBe('1-0')
  })

  it('returns starting FEN', () => {
    const game = parsePgn(SAMPLE_PGN)
    expect(game.startingFen).toContain('rnbqkbnr/pppppppp')
  })

  it('handles PGN with SetUp and FEN header', () => {
    const pgn = `[Event "Test"]
[SetUp "1"]
[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 1"]
[Result "*"]

Kf2 Ke7 1-0`
    const game = parsePgn(pgn)
    expect(game.startingFen).toContain('4k3')
    expect(game.moves.length).toBeGreaterThan(0)
  })

  it('handles empty/malformed PGN gracefully', () => {
    const game = parsePgn('')
    expect(game.moves).toEqual([])
    expect(game.result).toBe('*')
  })

  it('parses castling moves', () => {
    const pgn = `[Event "Test"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *`
    const game = parsePgn(pgn)
    const oo = game.moves.find((m) => m.san === 'O-O')
    expect(oo).toBeDefined()
    expect(oo!.uci).toBe('e1g1')
  })

  it('parses promotion moves', () => {
    const pgn = `[Event "Test"]
[Result "*"]

1. a4 b5 2. axb5 a5 3. b6 a4 4. b7 a3 5. bxa8=Q *`
    const game = parsePgn(pgn)
    expect(game.moves.length).toBeGreaterThan(0)
    const promo = game.moves.find((m) => m.promotion !== undefined)
    expect(promo).toBeDefined()
    expect(promo!.promotion).toBe('queen')
  })
})

describe('parsePgnGames', () => {
  it('parses multiple games from a single string', () => {
    const pgnText = `[Event "Game 1"]
[Result "1-0"]

1. e4 e5 2. Qh5 Ke7 3. Qxe5# 1-0

[Event "Game 2"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1`

    const games = parsePgnGames(pgnText)
    expect(games.length).toBe(2)
    expect(games[0].headers['Event']).toBe('Game 1')
    expect(games[1].headers['Event']).toBe('Game 2')
  })

  it('handles a single game', () => {
    const games = parsePgnGames(SAMPLE_PGN)
    expect(games.length).toBe(1)
  })

  it('handles empty string', () => {
    const games = parsePgnGames('')
    expect(games).toEqual([])
  })
})

describe('writePgn — round-trip', () => {
  it('round-trips headers and moves', () => {
    const game = parsePgn(SAMPLE_PGN)
    const rewritten = writePgn(game)
    const reparsed = parsePgn(rewritten)
    
    expect(reparsed.headers['White']).toBe('Alice')
    expect(reparsed.headers['Black']).toBe('Bob')
    expect(reparsed.headers['Result']).toBe('1-0')
    expect(reparsed.moves.length).toBe(game.moves.length)
    expect(reparsed.moves[0].uci).toBe('e2e4')
    expect(reparsed.moves[0].san).toBe('e4')
  })
})
