import { describe, it, expect } from 'vitest'
import {
  getUserResult,
  getOpening,
  getEco,
  parseEcoUrlName,
  detectTurningPoint,
  analyzeGame,
  detectEndgameFailures,
  aggregateOpenings,
  computeOpeningBlunderRates,
  aggregateEndgame,
  aggregateTurningPoints,
  generateRecommendations,
  slugifyOpening,
  computeAverageAccuracy,
  buildReport,
} from '../src/weaknesses/analysis'
import type { ParsedGame, EvalScore, MoveInfo, Color, MoveClassification } from '../src/chess/types'

function makeGame(opts: {
  moves?: MoveInfo[]
  result?: string
  opening?: string
  eco?: string
  ecoUrl?: string
  white?: string
  black?: string
  startingFen?: string
}): ParsedGame {
  const headers: Record<string, string> = {
    Opening: opts.opening ?? 'Unknown',
    ECO: opts.eco || '',
    White: opts.white || 'White',
    Black: opts.black || 'Black',
    Result: opts.result || '*',
  }
  if (opts.ecoUrl !== undefined) headers.ECOUrl = opts.ecoUrl
  return {
    headers,
    moves: opts.moves || [],
    result: (opts.result as ParsedGame['result']) || '*',
    startingFen: opts.startingFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  }
}

function makeMove(ply: number, color: Color, uci = 'e2e4', san = 'e4'): MoveInfo {
  void ply
  return {
    uci,
    san,
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    color,
    piece: 'pawn',
    flags: '',
    fenBefore: '',
    fenAfter: '',
  }
}

describe('getUserResult', () => {
  it('returns win when user is White and result is 1-0', () => {
    const game = makeGame({ result: '1-0' })
    expect(getUserResult(game, 'white')).toBe('win')
  })

  it('returns loss when user is Black and result is 1-0', () => {
    const game = makeGame({ result: '1-0' })
    expect(getUserResult(game, 'black')).toBe('loss')
  })

  it('returns win when user is Black and result is 0-1', () => {
    const game = makeGame({ result: '0-1' })
    expect(getUserResult(game, 'black')).toBe('win')
  })

  it('returns loss when user is White and result is 0-1', () => {
    const game = makeGame({ result: '0-1' })
    expect(getUserResult(game, 'white')).toBe('loss')
  })

  it('returns draw for 1/2-1/2', () => {
    const game = makeGame({ result: '1/2-1/2' })
    expect(getUserResult(game, 'white')).toBe('draw')
    expect(getUserResult(game, 'black')).toBe('draw')
  })
})

describe('getOpening / getEco', () => {
  it('extracts opening name from headers', () => {
    const game = makeGame({ opening: 'Sicilian Defense' })
    expect(getOpening(game)).toBe('Sicilian Defense')
  })

  it('returns Unknown if no opening header and no ECO/ECOUrl', () => {
    const game = makeGame({ opening: '', eco: '' })
    expect(getOpening(game)).toBe('Unknown')
  })

  it('extracts ECO code', () => {
    const game = makeGame({ eco: 'B20' })
    expect(getEco(game)).toBe('B20')
  })

  it('resolves opening name from chess.com ECOUrl slug (regression: B1 — was Unknown)', () => {
    const game = makeGame({
      opening: '',
      eco: 'A46',
      ecoUrl: 'https://www.chess.com/openings/Indian-Game-Spielmann-Indian-Variation...4.Nxd4-d5-5.Bg2-e5',
    })
    expect(getOpening(game)).toBe('Indian Game Spielmann Indian Variation')
  })

  it('prefers the Opening header over ECOUrl when both present', () => {
    const game = makeGame({
      opening: 'Indian Game',
      eco: 'A46',
      ecoUrl: 'https://www.chess.com/openings/Indian-Game-Spielmann-Indian-Variation...4.Nxd4-d5-5.Bg2-e5',
    })
    expect(getOpening(game)).toBe('Indian Game')
  })

  it('falls back to ECO code when ECOUrl is absent or unparseable', () => {
    const game = makeGame({ opening: '', eco: 'B20' })
    expect(getOpening(game)).toBe('B20')
  })

  it('falls back to ECO code when ECOUrl has no /openings/ segment', () => {
    const game = makeGame({ opening: '', eco: 'C28', ecoUrl: 'https://example.com/foo' })
    expect(getOpening(game)).toBe('C28')
  })
})

describe('parseEcoUrlName', () => {
  it('parses a chess.com ECOUrl slug into a human-readable name', () => {
    const url = 'https://www.chess.com/openings/Indian-Game-Spielmann-Indian-Variation...4.Nxd4-d5-5.Bg2-e5'
    expect(parseEcoUrlName(url)).toBe('Indian Game Spielmann Indian Variation')
  })

  it('strips query strings', () => {
    const url = 'https://www.chess.com/openings/French-Defense?ref=abc'
    expect(parseEcoUrlName(url)).toBe('French Defense')
  })

  it('returns empty string for non-chess.com URLs without /openings/', () => {
    expect(parseEcoUrlName('https://example.com/foo')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(parseEcoUrlName('')).toBe('')
  })
})

describe('detectTurningPoint', () => {
  it('detects won from losing position', () => {
    const evals: EvalScore[] = [
      { cp: 0 },
      { cp: -300 },
      { cp: -600 },
      { cp: 500 },
      { cp: 1000 },
    ]
    const classifications = ['good', 'blunder', 'best', 'best', 'best'] as const
    const tp = detectTurningPoint(evals, 'white', [...classifications], 'win')
    expect(tp).not.toBeNull()
    expect(tp!.wonFromLosing).toBe(true)
    expect(tp!.lostFromWinning).toBe(false)
  })

  it('detects lost from winning position', () => {
    const evals: EvalScore[] = [
      { cp: 0 },
      { cp: 300 },
      { cp: 600 },
      { cp: -500 },
      { cp: -1000 },
    ]
    const classifications = ['good', 'best', 'blunder', 'blunder', 'blunder'] as const
    const tp = detectTurningPoint(evals, 'white', [...classifications], 'loss')
    expect(tp).not.toBeNull()
    expect(tp!.lostFromWinning).toBe(true)
    expect(tp!.wonFromLosing).toBe(false)
  })

  it('detects went wrong in first 10 moves', () => {
    const evals: EvalScore[] = [
      { cp: 0 },
      { cp: -500 },
      { cp: 0 },
    ]
    const classifications = ['blunder', 'good'] as const
    const tp = detectTurningPoint(evals, 'white', [...classifications], 'loss')
    expect(tp).not.toBeNull()
    expect(tp!.wentWrongInFirst10).toBe(true)
  })

  it('detects built advantage then lost it', () => {
    const evals: EvalScore[] = []
    for (let i = 0; i < 15; i++) {
      evals.push({ cp: 200 })
    }
    for (let i = 0; i < 15; i++) {
      evals.push({ cp: -300 })
    }
    const classifications: MoveClassification[] = new Array(30).fill('good')
    const tp = detectTurningPoint(evals, 'white', classifications, 'loss')
    expect(tp).not.toBeNull()
    expect(tp!.builtAdvantageThenLost).toBe(true)
  })

  it('returns null for empty evals', () => {
    const tp = detectTurningPoint([], 'white', [], 'draw')
    expect(tp).toBeNull()
  })

  it('does not flag builtAdvantageThenLost when user wins', () => {
    const evals: EvalScore[] = []
    for (let i = 0; i < 15; i++) evals.push({ cp: 200 })
    for (let i = 0; i < 15; i++) evals.push({ cp: -300 })
    const classifications: MoveClassification[] = new Array(30).fill('good')
    const tp = detectTurningPoint(evals, 'white', classifications, 'win')
    expect(tp!.builtAdvantageThenLost).toBe(false)
  })

  it('works from Black perspective', () => {
    const evals: EvalScore[] = [
      { cp: 0 },
      { cp: 300 },
      { cp: -500 },
    ]
    const classifications = ['best', 'best'] as const
    const tp = detectTurningPoint(evals, 'black', [...classifications], 'win')
    expect(tp!.wonFromLosing).toBe(true)
  })
})

describe('detectEndgameFailures', () => {
  it('returns false when user won', () => {
    const game = makeGame({ result: '1-0' })
    const evals: EvalScore[] = [{ cp: 0 }]
    const phases = ['opening']
    const result = detectEndgameFailures(game, 'white', evals, phases as unknown as import('../src/chess/types').GamePhase[], 'win')
    expect(result.lostDrawnEndgame).toBe(false)
    expect(result.lostRookEndgame).toBe(false)
  })

  it('returns false when user drew', () => {
    const game = makeGame({ result: '1/2-1/2' })
    const evals: EvalScore[] = [{ cp: 0 }]
    const phases = ['endgame']
    const result = detectEndgameFailures(game, 'white', evals, phases as unknown as import('../src/chess/types').GamePhase[], 'draw')
    expect(result.lostDrawnEndgame).toBe(false)
    expect(result.lostRookEndgame).toBe(false)
  })
})

describe('slugifyOpening', () => {
  it('converts opening name to URL slug', () => {
    expect(slugifyOpening('Sicilian Defense')).toBe('sicilian-defense')
    expect(slugifyOpening("King's Gambit")).toBe('king-s-gambit')
    expect(slugifyOpening('Ruy Lopez, Berlin')).toBe('ruy-lopez-berlin')
  })
})

describe('analyzeGame', () => {
  it('analyzes a game with evals', () => {
    const moves: MoveInfo[] = [
      makeMove(0, 'white', 'e2e4', 'e4'),
      makeMove(1, 'black', 'e7e5', 'e5'),
      makeMove(2, 'white', 'g1f3', 'Nf3'),
      makeMove(3, 'black', 'b8c6', 'Nc6'),
    ]
    const game = makeGame({ moves, result: '1-0', opening: 'Italian Game', eco: 'C50' })
    const evals: EvalScore[] = [
      { cp: 20 },
      { cp: 30 },
      { cp: 25 },
      { cp: 35 },
      { cp: 30 },
    ]

    const analysis = analyzeGame(game, 'white', evals)
    expect(analysis.opening).toBe('Italian Game')
    expect(analysis.eco).toBe('C50')
    expect(analysis.userResult).toBe('win')
    expect(analysis.classifications).toHaveLength(2)
    expect(analysis.phases).toHaveLength(4)
    expect(analysis.evals).toBe(evals)
  })

  it('handles empty game', () => {
    const game = makeGame({ result: '*' })
    const analysis = analyzeGame(game, 'white', [])
    expect(analysis.classifications).toHaveLength(0)
    expect(analysis.totalBlunders).toBe(0)
  })
})

describe('aggregateOpenings', () => {
  it('aggregates openings by name and perspective', () => {
    const moves: MoveInfo[] = [makeMove(0, 'white', 'e2e4', 'e4'), makeMove(1, 'black', 'e7e5', 'e5')]
    const game1 = makeGame({ moves, result: '0-1', opening: 'Sicilian Defense', eco: 'B20' })
    const game2 = makeGame({ moves, result: '1-0', opening: 'Sicilian Defense', eco: 'B20' })
    const evals = [{ cp: 0 }, { cp: 0 }, { cp: 0 }]

    const a1 = analyzeGame(game1, 'white', evals)
    const a2 = analyzeGame(game2, 'white', evals)
    a1.index = 0
    a2.index = 1

    const openings = aggregateOpenings([a1, a2])
    expect(openings).toHaveLength(1)
    expect(openings[0].name).toBe('Sicilian Defense')
    expect(openings[0].games).toBe(2)
    expect(openings[0].wins).toBe(1)
    expect(openings[0].losses).toBe(1)
  })
})

describe('generateRecommendations', () => {
  it('generates recommendation for high-loss opening', () => {
    const openings = [
      { name: 'Sicilian Defense', eco: 'B20', games: 5, wins: 1, losses: 4, draws: 0, perspective: 'played' as const, blunderRate: 0.15, accuracy: 80 },
    ]
    const endgame = { endgameGames: 3, endgameBlunders: 2, lostDrawnEndgames: 1, lostRookEndgames: 1, endgameAccuracy: 70 }
    const turningPoints = { wonFromLosing: 0, lostFromWinning: 1, wentWrongInFirst10: 2, builtAdvantageThenLost: 1 }

    const recs = generateRecommendations(openings, endgame, turningPoints)
    expect(recs.length).toBeGreaterThan(0)

    const sicilianRec = recs.find((r) => r.title.includes('Sicilian'))
    expect(sicilianRec).toBeDefined()
    expect(sicilianRec!.puzzleLink).toContain('/puzzles?set=sicilian-defense')
  })

  it('generates endgame recommendations', () => {
    const openings: [] = []
    const endgame = { endgameGames: 5, endgameBlunders: 4, lostDrawnEndgames: 2, lostRookEndgames: 2, endgameAccuracy: 60 }
    const turningPoints = { wonFromLosing: 0, lostFromWinning: 0, wentWrongInFirst10: 0, builtAdvantageThenLost: 0 }

    const recs = generateRecommendations(openings, endgame, turningPoints)
    expect(recs.some((r) => r.title.includes('drawn endgames'))).toBe(true)
    expect(recs.some((r) => r.title.includes('rook endgames'))).toBe(true)
    expect(recs.some((r) => r.title.includes('endgame blunders'))).toBe(true)
  })

  it('generates turning-point recommendations', () => {
    const openings: [] = []
    const endgame = { endgameGames: 0, endgameBlunders: 0, lostDrawnEndgames: 0, lostRookEndgames: 0, endgameAccuracy: 0 }
    const turningPoints = { wonFromLosing: 0, lostFromWinning: 0, wentWrongInFirst10: 5, builtAdvantageThenLost: 3 }

    const recs = generateRecommendations(openings, endgame, turningPoints)
    expect(recs.some((r) => r.title.includes('Convert winning'))).toBe(true)
    expect(recs.some((r) => r.title.includes('opening play'))).toBe(true)
  })

  it('returns empty for no weaknesses', () => {
    const recs = generateRecommendations([], { endgameGames: 0, endgameBlunders: 0, lostDrawnEndgames: 0, lostRookEndgames: 0, endgameAccuracy: 0 }, { wonFromLosing: 0, lostFromWinning: 0, wentWrongInFirst10: 0, builtAdvantageThenLost: 0 })
    expect(recs).toHaveLength(0)
  })
})

describe('buildReport', () => {
  it('builds a complete report from analyses', () => {
    const moves: MoveInfo[] = [makeMove(0, 'white', 'e2e4', 'e4'), makeMove(1, 'black', 'e7e5', 'e5')]
    const game = makeGame({ moves, result: '1-0', opening: 'Italian Game', eco: 'C50' })
    const evals = [{ cp: 30 }, { cp: 35 }, { cp: 30 }]
    const analysis = analyzeGame(game, 'white', evals)

    const report = buildReport([analysis])
    expect(report.totalGames).toBe(1)
    expect(report.completedGames).toBe(1)
    expect(report.openings).toHaveLength(1)
    expect(report.openings[0].name).toBe('Italian Game')
  })
})

describe('computeOpeningBlunderRates', () => {
  it('computes blunder rates per opening', () => {
    const moves: MoveInfo[] = [makeMove(0, 'white', 'e2e4', 'e4'), makeMove(1, 'black', 'e7e5', 'e5')]
    const game = makeGame({ moves, result: '0-1', opening: 'Sicilian', eco: 'B20' })
    const evals = [{ cp: 0 }, { cp: -500 }, { cp: -1000 }]
    const analysis = analyzeGame(game, 'white', evals)

    const rates = computeOpeningBlunderRates([analysis])
    expect(rates).toHaveLength(1)
    expect(rates[0].name).toBe('Sicilian')
  })
})

describe('aggregateEndgame', () => {
  it('aggregates endgame stats', () => {
    const moves: MoveInfo[] = [makeMove(0, 'white', 'e2e4', 'e4')]
    const game = makeGame({ moves, result: '0-1' })
    const evals = [{ cp: 0 }, { cp: 0 }]
    const analysis = analyzeGame(game, 'white', evals)
    analysis.phases = ['endgame']
    analysis.lostDrawnEndgame = true
    analysis.lostRookEndgame = false
    analysis.endgameBlunders = 1

    const endgame = aggregateEndgame([analysis])
    expect(endgame.endgameGames).toBe(1)
    expect(endgame.lostDrawnEndgames).toBe(1)
    expect(endgame.endgameBlunders).toBe(1)
  })
})

describe('aggregateTurningPoints', () => {
  it('aggregates turning point counts', () => {
    const moves: MoveInfo[] = [makeMove(0, 'white', 'e2e4', 'e4')]
    const game = makeGame({ moves, result: '0-1' })
    const evals = [{ cp: 0 }, { cp: 0 }]
    const analysis = analyzeGame(game, 'white', evals)
    analysis.turningPoint = {
      wonFromLosing: false,
      lostFromWinning: true,
      wentWrongInFirst10: true,
      builtAdvantageThenLost: false,
    }

    const tp = aggregateTurningPoints([analysis])
    expect(tp.lostFromWinning).toBe(1)
    expect(tp.wentWrongInFirst10).toBe(1)
  })
})

describe('computeAverageAccuracy', () => {
  it('computes average accuracy across games', () => {
    const moves: MoveInfo[] = [makeMove(0, 'white', 'e2e4', 'e4'), makeMove(1, 'black', 'e7e5', 'e5')]
    const game = makeGame({ moves, result: '1-0' })
    const evals = [{ cp: 30 }, { cp: 35 }, { cp: 30 }]
    const analysis = analyzeGame(game, 'white', evals)

    const avg = computeAverageAccuracy([analysis])
    expect(avg).toBeGreaterThan(0)
    expect(avg).toBeLessThanOrEqual(100)
  })
})
