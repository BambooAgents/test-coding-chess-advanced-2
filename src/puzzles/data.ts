/**
 * Puzzle data — loads the bundled puzzle JSON.
 *
 * The curated puzzle set is bundled as a build asset. This module provides
 * a singleton index for the app to use.
 */

import type { Puzzle, PuzzleIndex } from './types'
import { buildIndex } from './loader'
import puzzleData from '../data/puzzles.json'

// Cast the imported JSON to Puzzle[]
const puzzles = puzzleData as unknown as Puzzle[]

// Build the index once (singleton)
let _index: PuzzleIndex | null = null

/**
 * Get the puzzle index (singleton).
 */
export function getPuzzleIndex(): PuzzleIndex {
  if (!_index) {
    _index = buildIndex(puzzles)
  }
  return _index
}

/**
 * Get all puzzles.
 */
export function getAllPuzzles(): Puzzle[] {
  return getPuzzleIndex().all
}

/**
 * Get the total puzzle count.
 */
export function getPuzzleCount(): number {
  return puzzles.length
}
