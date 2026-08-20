/**
 * Puzzle loader and indexer.
 *
 * Loads the curated puzzle bundle (JSON) and indexes by theme and opening
 * for the themed-sets feature.
 */

import type { Puzzle, PuzzleIndex } from './types'

/**
 * Parse a raw puzzle row (from the lichess CSV format) into a Puzzle.
 * CSV fields: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
 */
export function parsePuzzleRow(row: string): Puzzle {
  // Split by comma but handle the fact that fields don't contain commas
  // (lichess CSV is simple — no quoting needed)
  const parts = row.split(',')
  if (parts.length < 10) {
    throw new Error(`Invalid puzzle row: expected 10 fields, got ${parts.length}`)
  }

  const [
    id,
    fen,
    movesStr,
    ratingStr,
    ratingDeviationStr,
    popularityStr,
    nbPlaysStr,
    themesStr,
    gameUrl,
    openingTagsStr,
  ] = parts

  return {
    id: id.trim(),
    fen: fen.trim(),
    moves: movesStr.trim().split(/\s+/).filter(Boolean),
    rating: parseInt(ratingStr, 10) || 0,
    ratingDeviation: parseInt(ratingDeviationStr, 10) || 0,
    popularity: parseInt(popularityStr, 10) || 0,
    nbPlays: parseInt(nbPlaysStr, 10) || 0,
    themes: themesStr.trim() ? themesStr.trim().split(' ').filter(Boolean) : [],
    openingTags: openingTagsStr.trim() ? openingTagsStr.trim().split(' ').filter(Boolean) : [],
    gameUrl: gameUrl.trim(),
  }
}

/**
 * Build an index from a list of puzzles.
 * The index allows efficient lookup by theme, opening, or rating band.
 */
export function buildIndex(puzzles: Puzzle[]): PuzzleIndex {
  const byTheme = new Map<string, Puzzle[]>()
  const byOpening = new Map<string, Puzzle[]>()

  for (const puzzle of puzzles) {
    for (const theme of puzzle.themes) {
      if (!byTheme.has(theme)) byTheme.set(theme, [])
      byTheme.get(theme)!.push(puzzle)
    }
    for (const opening of puzzle.openingTags) {
      if (!byOpening.has(opening)) byOpening.set(opening, [])
      byOpening.get(opening)!.push(puzzle)
    }
  }

  // Sort keys alphabetically for deterministic ordering
  const themes = Array.from(byTheme.keys()).sort()
  const openings = Array.from(byOpening.keys()).sort()

  // Build rating bands
  const ratings = puzzles.map((p) => p.rating)
  const minRating = ratings.length > 0 ? Math.min(...ratings) : 0
  const maxRating = ratings.length > 0 ? Math.max(...ratings) : 3000
  const bandSize = 400
  const ratingBands: { min: number; max: number; label: string }[] = []
  for (let min = Math.floor(minRating / bandSize) * bandSize; min < maxRating; min += bandSize) {
    ratingBands.push({
      min,
      max: min + bandSize,
      label: `${min}-${min + bandSize}`,
    })
  }

  return {
    all: puzzles,
    byTheme,
    byOpening,
    themes,
    openings,
    ratingBands,
  }
}

/**
 * Filter puzzles by rating range.
 */
export function filterByRating(puzzles: Puzzle[], min: number, max: number): Puzzle[] {
  return puzzles.filter((p) => p.rating >= min && p.rating < max)
}

/**
 * Get puzzles for a specific theme.
 */
export function getByTheme(index: PuzzleIndex, theme: string): Puzzle[] {
  return index.byTheme.get(theme) ?? []
}

/**
 * Get puzzles for a specific opening.
 */
export function getByOpening(index: PuzzleIndex, opening: string): Puzzle[] {
  return index.byOpening.get(opening) ?? []
}

/**
 * Get endgame-themed puzzles (themes that contain 'endgame' or 'rookEndgame' etc.).
 */
export function getEndgamePuzzles(index: PuzzleIndex): Puzzle[] {
  const endgameThemes = index.themes.filter((t) =>
    t.toLowerCase().includes('endgame'),
  )
  const result: Puzzle[] = []
  const seen = new Set<string>()
  for (const theme of endgameThemes) {
    for (const puzzle of getByTheme(index, theme)) {
      if (!seen.has(puzzle.id)) {
        seen.add(puzzle.id)
        result.push(puzzle)
      }
    }
  }
  return result
}

/**
 * Shuffle an array (Fisher-Yates) and return a new array.
 */
export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
