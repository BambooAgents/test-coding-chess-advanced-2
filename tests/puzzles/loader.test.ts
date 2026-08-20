import { describe, it, expect } from 'vitest'
import {
  parsePuzzleRow,
  buildIndex,
  filterByRating,
  getByTheme,
  getByOpening,
  getEndgamePuzzles,
  shuffle,
} from '../../src/puzzles/loader'
import type { Puzzle } from '../../src/puzzles/types'

// Sample puzzle data for testing
const samplePuzzles: Puzzle[] = [
  {
    id: 'p1',
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1',
    moves: ['g1f3', 'e5e4'],
    rating: 1500,
    ratingDeviation: 80,
    popularity: 100,
    nbPlays: 5000,
    themes: ['opening', 'fork'],
    openingTags: ['Kings_Gambit'],
    gameUrl: 'https://lichess.org/abc123',
  },
  {
    id: 'p2',
    fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1',
    moves: ['e4e5', 'e6e7'],
    rating: 1800,
    ratingDeviation: 90,
    popularity: 50,
    nbPlays: 2000,
    themes: ['endgame', 'rookEndgame'],
    openingTags: [],
    gameUrl: 'https://lichess.org/def456',
  },
  {
    id: 'p3',
    fen: 'r1bqkbnr/pppp2pp/2n5/4pp2/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1',
    moves: ['f3e5', 'd8e7'],
    rating: 2100,
    ratingDeviation: 70,
    popularity: 80,
    nbPlays: 3000,
    themes: ['opening', 'pin'],
    openingTags: ['Ruy_Lopez'],
    gameUrl: 'https://lichess.org/ghi789',
  },
  {
    id: 'p4',
    fen: '8/8/4k3/8/8/8/4K3/4R3 w - - 0 1',
    moves: ['e1e6', 'e7e8'],
    rating: 1200,
    ratingDeviation: 100,
    popularity: 90,
    nbPlays: 8000,
    themes: ['endgame', 'mateIn2'],
    openingTags: [],
    gameUrl: 'https://lichess.org/jkl012',
  },
]

describe('parsePuzzleRow', () => {
  it('parses a valid CSV row', () => {
    // Real lichess CSV order: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
    const row = '00Q42Nod+8d2,rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1,g1f3 e5e4,1500,80,100,5000,opening fork,https://lichess.org/abc123,Kings_Gambit,2023-01-01'
    const puzzle = parsePuzzleRow(row)
    expect(puzzle.id).toBe('00Q42Nod+8d2')
    expect(puzzle.fen).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1')
    expect(puzzle.moves).toEqual(['g1f3', 'e5e4'])
    expect(puzzle.rating).toBe(1500)
    expect(puzzle.themes).toEqual(['opening', 'fork'])
    expect(puzzle.openingTags).toEqual(['Kings_Gambit'])
    expect(puzzle.gameUrl).toBe('https://lichess.org/abc123')
  })

  it('handles empty themes', () => {
    // Real CSV order: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
    // Both Themes and OpeningTags empty, plus DailyDate
    const row = 'p1,rnbqkbnr w KQkq - 0 1,e2e4,1500,80,100,5000,,https://lichess.org/x,,2023-01-01'
    const puzzle = parsePuzzleRow(row)
    expect(puzzle.themes).toEqual([])
    expect(puzzle.openingTags).toEqual([])
    expect(puzzle.gameUrl).toBe('https://lichess.org/x')
  })

  it('throws on invalid row', () => {
    expect(() => parsePuzzleRow('a,b,c')).toThrow('expected 10 fields')
  })
})

describe('buildIndex', () => {
  it('indexes puzzles by theme', () => {
    const index = buildIndex(samplePuzzles)
    expect(index.all).toHaveLength(4)
    expect(getByTheme(index, 'endgame')).toHaveLength(2)
    expect(getByTheme(index, 'opening')).toHaveLength(2)
    expect(getByTheme(index, 'fork')).toHaveLength(1)
  })

  it('indexes puzzles by opening', () => {
    const index = buildIndex(samplePuzzles)
    expect(getByOpening(index, 'Kings_Gambit')).toHaveLength(1)
    expect(getByOpening(index, 'Ruy_Lopez')).toHaveLength(1)
  })

  it('lists all unique themes and openings', () => {
    const index = buildIndex(samplePuzzles)
    expect(index.themes).toContain('endgame')
    expect(index.themes).toContain('rookEndgame')
    expect(index.themes).toContain('opening')
    expect(index.themes).toContain('fork')
    expect(index.themes).toContain('pin')
    expect(index.openings).toContain('Kings_Gambit')
    expect(index.openings).toContain('Ruy_Lopez')
  })

  it('builds rating bands', () => {
    const index = buildIndex(samplePuzzles)
    expect(index.ratingBands.length).toBeGreaterThan(0)
    // Should cover the range 1200–2100
    expect(index.ratingBands[0].min).toBeLessThanOrEqual(1200)
    expect(index.ratingBands[index.ratingBands.length - 1].max).toBeGreaterThanOrEqual(2100)
  })
})

describe('filterByRating', () => {
  it('filters within a rating range', () => {
    const filtered = filterByRating(samplePuzzles, 1400, 2000)
    expect(filtered).toHaveLength(2) // p1 (1500) and p2 (1800)
    expect(filtered.map((p) => p.id)).toContain('p1')
    expect(filtered.map((p) => p.id)).toContain('p2')
  })

  it('returns empty for out-of-range', () => {
    const filtered = filterByRating(samplePuzzles, 3000, 4000)
    expect(filtered).toHaveLength(0)
  })
})

describe('getEndgamePuzzles', () => {
  it('returns puzzles with endgame themes', () => {
    const index = buildIndex(samplePuzzles)
    const endgames = getEndgamePuzzles(index)
    expect(endgames).toHaveLength(2)
    const ids = endgames.map((p) => p.id)
    expect(ids).toContain('p2')
    expect(ids).toContain('p4')
  })

  it('does not return opening puzzles', () => {
    const index = buildIndex(samplePuzzles)
    const endgames = getEndgamePuzzles(index)
    expect(endgames.map((p) => p.id)).not.toContain('p1')
    expect(endgames.map((p) => p.id)).not.toContain('p3')
  })
})

describe('shuffle', () => {
  it('preserves length', () => {
    const shuffled = shuffle(samplePuzzles)
    expect(shuffled).toHaveLength(samplePuzzles.length)
  })

  it('returns a new array (does not mutate original)', () => {
    const original = [...samplePuzzles]
    const shuffled = shuffle(samplePuzzles)
    expect(shuffled).not.toBe(samplePuzzles)
    expect(samplePuzzles).toEqual(original)
  })

  it('contains same elements', () => {
    const shuffled = shuffle(samplePuzzles)
    const originalIds = new Set(samplePuzzles.map((p) => p.id))
    const shuffledIds = new Set(shuffled.map((p) => p.id))
    expect(shuffledIds).toEqual(originalIds)
  })
})
