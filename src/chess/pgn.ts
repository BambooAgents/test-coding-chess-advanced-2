/**
 * PGN parsing and writing.
 *
 * Uses chess.js for the heavy lifting, wrapped in a clean module.
 * Round-trip stable: headers + moves are preserved.
 */

import { Chess } from 'chess.js'
import type { ParsedGame, PgnHeaders, MoveInfo, GameResult } from './types'
import { verboseToMoveInfoHelper } from './moveUtils'

/**
 * Parse a PGN string into a ParsedGame.
 *
 * Preserves headers, moves (with FEN before/after for each move),
 * and the game result.
 */
export function parsePgn(pgn: string): ParsedGame {
  const chess = new Chess()

  let headers: PgnHeaders = {}
  let result: GameResult = '*'

  try {
    chess.loadPgn(pgn)
    headers = chess.header() as PgnHeaders
    // Clean up null values from chess.js header
    for (const key of Object.keys(headers)) {
      if (headers[key] === null || headers[key] === 'null') {
        delete headers[key]
      }
    }
    result = (headers.Result as GameResult) || '*'
  } catch {
    // If chess.js can't parse, return what we can
    return {
      headers: {},
      moves: [],
      result: '*',
      startingFen: new Chess().fen(),
    }
  }

  // Get the starting FEN — check the FEN header set by chess.js
  // chess.js stores it in the header under 'FEN' but may also set it in the position
  const headersFen = headers.FEN || headers.fen
  const startingFen = headersFen || new Chess().fen()

  // Replay moves to get verbose info (with FEN before/after)
  const moves: MoveInfo[] = []
  // Re-load with PGN to get move history
  const replayChess = new Chess()
  if (headers.FEN) {
    replayChess.load(headers.FEN)
  }

  try {
    replayChess.loadPgn(pgn)
    const verboseMoves = replayChess.history({ verbose: true })
    for (const m of verboseMoves) {
      moves.push(verboseToMoveInfoHelper(m))
    }
  } catch {
    // If replay fails, at least return headers
  }

  return {
    headers,
    moves,
    result,
    startingFen,
  }
}

/**
 * Parse multiple PGN games from a single string.
 * Each game is separated by a blank line or by the next [Event header.
 */
export function parsePgnGames(pgnText: string): ParsedGame[] {
  // Split on blank lines between games, or on [Event boundaries
  // A robust approach: find all PGN game blocks
  const games: ParsedGame[] = []

  // Normalize line endings
  const text = pgnText.replace(/\r\n/g, '\n').trim()
  if (!text) return games

  // Split by detecting [Event headers that start a new game
  // (but only when not inside the first game)
  const lines = text.split('\n')
  let currentGame = ''
  let foundFirstEvent = false

  for (const line of lines) {
    if (line.trim().startsWith('[Event ')) {
      if (foundFirstEvent && currentGame.trim()) {
        games.push(parsePgn(currentGame.trim()))
      }
      currentGame = line + '\n'
      foundFirstEvent = true
    } else {
      currentGame += line + '\n'
    }
  }

  if (currentGame.trim()) {
    games.push(parsePgn(currentGame.trim()))
  }

  return games
}

/**
 * Write a ParsedGame back to a PGN string.
 */
export function writePgn(game: ParsedGame): string {
  const chess = new Chess()

  // Set up starting position if non-standard
  if (game.startingFen && game.startingFen !== new Chess().fen()) {
    chess.load(game.startingFen)
  }

  // Set headers
  for (const [key, value] of Object.entries(game.headers)) {
    if (value) {
      chess.header(key, value)
    }
  }

  // Play moves
  for (const move of game.moves) {
    chess.move(move.uci)
  }

  return chess.pgn()
}
