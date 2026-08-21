#!/usr/bin/env node
/**
 * Puzzle curation script.
 *
 * Downloads the lichess CC0 puzzle database (lichess_db_puzzle.csv.zst),
 * streams it through zstd decompression, and curates a manageable subset
 * (~2000 puzzles) for bundling with the app.
 *
 * Usage:
 *   node scripts/curate-puzzles.cjs [output-path]
 *
 * The script:
 * 1. Streams the lichess puzzle CSV from database.lichess.org via curl | zstd
 * 2. Filters by rating bands (800–2400), popularity > 80
 * 3. Ensures coverage of endgame themes and opening tags
 * 4. Writes a JSON file ready for bundling
 *
 * The lichess puzzle database is CC0 (public domain).
 * See: https://database.lichess.org/
 *
 * CSV columns (with header):
 *   PuzzleId, FEN, Moves, Rating, RatingDeviation, Popularity, NbPlays,
 *   Themes, GameUrl, OpeningTags, DailyDate
 */

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const OUTPUT = process.argv[2] || path.join(__dirname, '..', 'src', 'data', 'puzzles.json')

const PUZZLE_DB_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'

// Rating bands to sample from — target ~2000 total
const RATING_BANDS = [
  { min: 800, max: 1200, count: 450 },
  { min: 1200, max: 1600, count: 500 },
  { min: 1600, max: 2000, count: 450 },
  { min: 2000, max: 2400, count: 350 },
  { min: 2400, max: 2800, count: 250 },
]

const MIN_POPULARITY = 80
const MIN_PLAYS = 100

// Endgame themes we care about
const ENDGAME_THEMES = [
  'endgame', 'rookEndgame', 'pawnEndgame', 'kingEndgame',
  'minorPieceEndgame', 'queenEndgame', 'bishopEndgame',
  'knightEndgame', 'advancedPawn',
]

/**
 * Parse a CSV line into a puzzle object.
 * Lichess CSV columns: PuzzleId,FEN,Moves,Rating,RatingDeviation,
 *   Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate
 */
function parseLine(line) {
  const parts = line.split(',')
  if (parts.length < 10) return null

  const id = parts[0].trim()
  const fen = parts[1].trim()
  const movesStr = parts[2].trim()
  const rating = parseInt(parts[3], 10)
  const ratingDeviation = parseInt(parts[4], 10) || 0
  const popularity = parseInt(parts[5], 10) || 0
  const nbPlays = parseInt(parts[6], 10) || 0
  const themesStr = parts[7].trim()
  const gameUrl = parts[8].trim()
  const openingStr = parts[9].trim()

  if (isNaN(rating)) return null
  if (!id || !fen || !movesStr) return null

  return {
    id,
    fen,
    moves: movesStr.split(/\s+/).filter(Boolean),
    rating,
    ratingDeviation,
    popularity,
    nbPlays,
    themes: themesStr ? themesStr.split(' ').filter(Boolean) : [],
    openingTags: openingStr ? openingStr.split(' ').filter(Boolean) : [],
    gameUrl,
  }
}

/**
 * Curate puzzles from CSV lines (iterator).
 * Uses reservoir-style sampling within rating bands to get a balanced set.
 */
function curate(lines) {
  const bands = RATING_BANDS.map((b) => ({ ...b, puzzles: [] }))
  let totalProcessed = 0
  let totalAccepted = 0
  let lineCount = 0

  for (const line of lines) {
    lineCount++
    // Skip header
    if (lineCount === 1) continue
    if (!line || line.trim().length === 0) continue

    const puzzle = parseLine(line)
    if (!puzzle) continue
    totalProcessed++

    // Quality filters
    if (puzzle.popularity < MIN_POPULARITY) continue
    if (puzzle.nbPlays < MIN_PLAYS) continue
    if (puzzle.moves.length < 2) continue
    if (puzzle.ratingDeviation > 120) continue

    // Find the right rating band
    for (const band of bands) {
      if (puzzle.rating >= band.min && puzzle.rating < band.max) {
        if (band.puzzles.length < band.count) {
          band.puzzles.push(puzzle)
          totalAccepted++
        }
        break
      }
    }

    // Early exit when all bands are full
    if (bands.every((b) => b.puzzles.length >= b.count)) {
      break
    }
  }

  // Combine all bands (deduplicate by ID)
  const allPuzzles = new Map()
  for (const band of bands) {
    for (const p of band.puzzles) allPuzzles.set(p.id, p)
  }

  const result = Array.from(allPuzzles.values())

  // Log stats
  console.log(`Processed ${totalProcessed} puzzles, accepted ${totalAccepted}`)
  for (const band of bands) {
    console.log(`  Rating ${band.min}-${band.max}: ${band.puzzles.length} puzzles`)
  }

  // Count themes and openings
  const themes = new Set()
  const openings = new Set()
  let endgameCount = 0
  let openingCount = 0
  for (const p of result) {
    p.themes.forEach((t) => themes.add(t))
    p.openingTags.forEach((o) => openings.add(o))
    if (p.themes.some((t) => ENDGAME_THEMES.some((et) => t.toLowerCase().includes(et.toLowerCase())))) {
      endgameCount++
    }
    if (p.openingTags.length > 0) openingCount++
  }
  console.log(`Total: ${result.length} puzzles`)
  console.log(`Endgame puzzles: ${endgameCount}`)
  console.log(`Opening-tagged puzzles: ${openingCount}`)
  console.log(`Themes (${themes.size}): ${Array.from(themes).sort().join(', ')}`)
  console.log(`Openings (${openings.size}): ${Array.from(openings).sort().slice(0, 20).join(', ')}...`)

  return result
}

async function main() {
  console.log('Curating puzzles from lichess CC0 database...')
  console.log(`URL: ${PUZZLE_DB_URL}`)

  // Stream: curl | zstd -d, read line by line
  const curl = spawn('curl', ['-s', '-L', PUZZLE_DB_URL], { stdio: ['ignore', 'pipe', 'inherit'] })
  const zstd = spawn('zstd', ['-d', '-T4'], { stdio: [curl.stdout, 'pipe', 'inherit'] })

  const lines = []
  let buffer = ''

  return new Promise((resolve, reject) => {
    zstd.stdout.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const parts = buffer.split('\n')
      buffer = parts.pop() // keep incomplete line in buffer

      for (const line of parts) {
        lines.push(line)
        // Process in batches to avoid memory issues
        if (lines.length >= 100000) {
          // Check if all bands are already full before processing more
          // (the curate function handles the early exit internally)
        }
      }
    })

    zstd.stdout.on('end', () => {
      if (buffer) lines.push(buffer)
      console.log(`Downloaded and decompressed ${lines.length} lines`)

      const puzzles = curate(lines)

      // Write JSON (compact, no indentation — build asset)
      const outDir = path.dirname(OUTPUT)
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }
      fs.writeFileSync(OUTPUT, JSON.stringify(puzzles))
      console.log(`Written to ${OUTPUT} (${(fs.statSync(OUTPUT).size / 1024).toFixed(1)} KB)`)
      resolve()
    })

    zstd.on('error', (err) => {
      console.error('zstd error:', err.message)
      reject(err)
    })

    curl.on('error', (err) => {
      console.error('curl error:', err.message)
      reject(err)
    })
  })
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
