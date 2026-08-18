/**
 * Analysis pipeline for the weakness analysis.
 * Pure functions — no I/O, no side effects. Testable in isolation.
 */

import type {
  Color,
  EvalScore,
  GamePhase,
  MoveClassification,
  ParsedGame,
} from '../chess/types'
import { Position } from '../chess/Position'
import { classifyMove } from '../chess/classifyMove'
import { povChances, accuracyFromWinPercents, povWinPercent } from '../chess/winningChances'
import type {
  GameAnalysis,
  OpeningStat,
  OpeningBlunderRate,
  WeaknessReport,
  TurningPoint,
  Recommendation,
  EndgameAnalysis,
  TurningPointSummary,
} from './types'

export function getUserResult(
  game: ParsedGame,
  userColor: Color,
): 'win' | 'loss' | 'draw' {
  const result = game.result
  if (result === '1-0') return userColor === 'white' ? 'win' : 'loss'
  if (result === '0-1') return userColor === 'black' ? 'win' : 'loss'
  return 'draw'
}

export function getOpening(game: ParsedGame): string {
  return game.headers.Opening || game.headers.opening || 'Unknown'
}

export function getEco(game: ParsedGame): string {
  return game.headers.ECO || game.headers.eco || ''
}

export function detectTurningPoint(
  evals: EvalScore[],
  userColor: Color,
  classifications: MoveClassification[],
  userResult: 'win' | 'loss' | 'draw',
): TurningPoint | null {
  if (evals.length === 0) return null

  const userChances = evals.map((ev) => povChances(userColor, ev))

  let maxChance = -Infinity
  let minChance = Infinity
  // let maxPly = 0
  // let minPly = 0

  for (let i = 0; i < userChances.length; i++) {
    if (userChances[i] > maxChance) {
      maxChance = userChances[i]
      // maxPly = i
    }
    if (userChances[i] < minChance) {
      minChance = userChances[i]
      // minPly = i
    }
  }

  const wonFromLosing = userResult === 'win' && minChance < -0.5
  const lostFromWinning = userResult === 'loss' && maxChance > 0.5

  const wentWrongInFirst10 = classifications.slice(0, 10).some(
    (c) => c === 'blunder' || c === 'mistake',
  )

  const first10Chances = userChances.slice(0, 20)
  const hadEarlyAdvantage = first10Chances.some((c) => c > 0.3)
  const laterDropped = userChances.slice(20).some((c) => c < -0.3)
  const builtAdvantageThenLost =
    userResult === 'loss' && hadEarlyAdvantage && laterDropped

  let turningPly: number | null = null
  let maxSwing = 0
  for (let i = 1; i < userChances.length; i++) {
    const swing = userChances[i - 1] - userChances[i]
    if (swing > maxSwing) {
      maxSwing = swing
      turningPly = i
    }
  }

  return {
    wonFromLosing,
    lostFromWinning,
    wentWrongInFirst10,
    builtAdvantageThenLost,
    turningPly,
  }
}

export function analyzeGame(
  game: ParsedGame,
  userColor: Color,
  evals: EvalScore[],
): GameAnalysis {
  const position = new Position(game.startingFen)
  const phases: GamePhase[] = []
  const classifications: MoveClassification[] = []

  for (let i = 0; i < game.moves.length; i++) {
    const move = game.moves[i]
    const phase = position.phase()
    phases.push(phase)

    const moverColor = move.color

    if (moverColor === userColor) {
      const evalBefore = evals[i] ?? { cp: 0 }
      const evalAfter = evals[i + 1] ?? evals[i] ?? { cp: 0 }
      const bestEval = evalBefore

      position.move(move.uci)
      const isCheckmate = position.isCheckmate()
      const isBestMove =
        evalBefore.cp !== undefined && evalAfter.cp !== undefined
          ? Math.abs(evalAfter.cp - evalBefore.cp) < 30
          : false
      position.undo()
      const legalMoveCount = position.moveCount()

      const classification = classifyMove({
        color: moverColor,
        evalBefore,
        evalAfter,
        bestEval,
        isCheckmate,
        legalMoveCount,
        ply: i,
        isOpening: phase === 'opening',
        isBestMove,
      })
      classifications.push(classification)
    }

    position.move(move.uci)
  }

  const totalBlunders = classifications.filter((c) => c === 'blunder').length
  const totalMistakes = classifications.filter((c) => c === 'mistake').length
  const totalInaccuracies = classifications.filter((c) => c === 'inaccuracy').length

  let endgameBlunders = 0
  let userMoveIdx = 0
  for (let i = 0; i < game.moves.length; i++) {
    if (game.moves[i].color === userColor) {
      if (phases[i] === 'endgame' && classifications[userMoveIdx] === 'blunder') {
        endgameBlunders++
      }
      userMoveIdx++
    }
  }

  const userResult = getUserResult(game, userColor)
  const { lostDrawnEndgame, lostRookEndgame } = detectEndgameFailures(
    game, userColor, evals, phases, userResult,
  )
  const turningPoint = detectTurningPoint(evals, userColor, classifications, userResult)

  return {
    index: 0,
    game,
    userColor,
    opening: getOpening(game),
    eco: getEco(game),
    userResult,
    evals,
    classifications,
    phases,
    turningPoint,
    endgameBlunders,
    totalBlunders,
    totalInaccuracies,
    totalMistakes,
    lostDrawnEndgame,
    lostRookEndgame,
  }
}

export function detectEndgameFailures(
  game: ParsedGame,
  userColor: Color,
  evals: EvalScore[],
  phases: GamePhase[],
  userResult: 'win' | 'loss' | 'draw',
): { lostDrawnEndgame: boolean; lostRookEndgame: boolean } {
  if (userResult !== 'loss') {
    return { lostDrawnEndgame: false, lostRookEndgame: false }
  }

  let lostDrawnEndgame = false
  let lostRookEndgame = false

  const position = new Position(game.startingFen)
  for (let i = 0; i < game.moves.length; i++) {
    const phase = phases[i]
    position.move(game.moves[i].uci)

    if (phase === 'endgame') {
      const evalAfter = evals[i + 1] ?? evals[i] ?? { cp: 0 }
      const userChance = povChances(userColor, evalAfter)
      if (Math.abs(userChance) < 0.1) {
        lostDrawnEndgame = true
      }

      const board = position.board()
      let hasRook = false
      let hasNonRookPawnKing = false
      for (const [, piece] of board) {
        if (piece.type === 'r') hasRook = true
        else if (piece.type !== 'p' && piece.type !== 'k') hasNonRookPawnKing = true
      }
      if (hasRook && !hasNonRookPawnKing) lostRookEndgame = true
    }
  }

  return { lostDrawnEndgame, lostRookEndgame }
}

export function aggregateOpenings(analyses: GameAnalysis[]): OpeningStat[] {
  const openingMap = new Map<string, OpeningStat & { _totalMoves: number; _totalBlunders: number; _accuracySum: number; _accuracyCount: number }>()

  for (const analysis of analyses) {
    const key = `${analysis.opening}|${analysis.eco}|${analysis.userColor === 'white' ? 'played' : 'faced'}`
    const existing = openingMap.get(key)
    const userMoves = analysis.classifications.length
    const blunders = analysis.totalBlunders

    let gameAccuracy = 0
    if (analysis.evals.length > 0 && userMoves > 0) {
      let accSum = 0
      let accCount = 0
      for (let i = 0; i < analysis.game.moves.length; i++) {
        if (analysis.game.moves[i].color === analysis.userColor) {
          const before = analysis.evals[i] ?? { cp: 0 }
          const after = analysis.evals[i + 1] ?? analysis.evals[i] ?? { cp: 0 }
          const beforePct = povWinPercent(analysis.userColor, before)
          const afterPct = povWinPercent(analysis.userColor, after)
          accSum += accuracyFromWinPercents(beforePct, afterPct)
          accCount++
        }
      }
      if (accCount > 0) gameAccuracy = accSum / accCount
    }

    if (existing) {
      existing.games++
      if (analysis.userResult === 'win') existing.wins++
      else if (analysis.userResult === 'loss') existing.losses++
      else existing.draws++
      existing._totalMoves += userMoves
      existing._totalBlunders += blunders
      existing._accuracySum += gameAccuracy
      existing._accuracyCount++
      existing.blunderRate = existing._totalBlunders / Math.max(1, existing._totalMoves)
      existing.accuracy = existing._accuracySum / Math.max(1, existing._accuracyCount)
    } else {
      openingMap.set(key, {
        name: analysis.opening,
        eco: analysis.eco,
        games: 1,
        wins: analysis.userResult === 'win' ? 1 : 0,
        losses: analysis.userResult === 'loss' ? 1 : 0,
        draws: analysis.userResult === 'draw' ? 1 : 0,
        perspective: analysis.userColor === 'white' ? 'played' : 'faced',
        blunderRate: userMoves > 0 ? blunders / userMoves : 0,
        accuracy: gameAccuracy,
        _totalMoves: userMoves,
        _totalBlunders: blunders,
        _accuracySum: gameAccuracy,
        _accuracyCount: 1,
      })
    }
  }

  const results = Array.from(openingMap.values()).map((s) => {
    const { _totalMoves, _totalBlunders, _accuracySum, _accuracyCount, ...stat } = s
    void _totalMoves; void _totalBlunders; void _accuracySum; void _accuracyCount
    return stat
  })
  return results.sort((a, b) => b.losses - a.losses)
}

export function computeOpeningBlunderRates(analyses: GameAnalysis[]): OpeningBlunderRate[] {
  const map = new Map<string, OpeningBlunderRate>()

  for (const analysis of analyses) {
    const key = `${analysis.opening}|${analysis.eco}|${analysis.userColor === 'white' ? 'played' : 'faced'}`
    const existing = map.get(key)
    const userMoves = analysis.classifications.length

    if (existing) {
      existing.userMoves += userMoves
      existing.blunders += analysis.totalBlunders
      existing.blunderRate = existing.blunders / Math.max(1, existing.userMoves)
    } else {
      map.set(key, {
        name: analysis.opening,
        eco: analysis.eco,
        userMoves,
        blunders: analysis.totalBlunders,
        blunderRate: userMoves > 0 ? analysis.totalBlunders / userMoves : 0,
        perspective: analysis.userColor === 'white' ? 'played' : 'faced',
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => b.blunderRate - a.blunderRate)
}

export function aggregateEndgame(analyses: GameAnalysis[]): EndgameAnalysis {
  let endgameGames = 0
  let endgameBlunders = 0
  let lostDrawnEndgames = 0
  let lostRookEndgames = 0
  let endgameAccuracySum = 0
  let endgameAccuracyCount = 0

  for (const analysis of analyses) {
    const hasEndgame = analysis.phases.some((p) => p === 'endgame')
    if (hasEndgame) {
      endgameGames++
      endgameBlunders += analysis.endgameBlunders
      if (analysis.lostDrawnEndgame) lostDrawnEndgames++
      if (analysis.lostRookEndgame) lostRookEndgames++
    }

    let egAccSum = 0
    let egAccCount = 0
    for (let i = 0; i < analysis.game.moves.length; i++) {
      if (analysis.game.moves[i].color === analysis.userColor && analysis.phases[i] === 'endgame') {
        const before = analysis.evals[i] ?? { cp: 0 }
        const after = analysis.evals[i + 1] ?? analysis.evals[i] ?? { cp: 0 }
        const beforePct = povWinPercent(analysis.userColor, before)
        const afterPct = povWinPercent(analysis.userColor, after)
        egAccSum += accuracyFromWinPercents(beforePct, afterPct)
        egAccCount++
      }
    }
    if (egAccCount > 0) {
      endgameAccuracySum += egAccSum / egAccCount
      endgameAccuracyCount++
    }
  }

  return {
    endgameGames,
    endgameBlunders,
    lostDrawnEndgames,
    lostRookEndgames,
    endgameAccuracy: endgameAccuracyCount > 0 ? endgameAccuracySum / endgameAccuracyCount : 0,
  }
}

export function aggregateTurningPoints(analyses: GameAnalysis[]): TurningPointSummary {
  let wonFromLosing = 0
  let lostFromWinning = 0
  let wentWrongInFirst10 = 0
  let builtAdvantageThenLost = 0

  for (const analysis of analyses) {
    if (analysis.turningPoint) {
      if (analysis.turningPoint.wonFromLosing) wonFromLosing++
      if (analysis.turningPoint.lostFromWinning) lostFromWinning++
      if (analysis.turningPoint.wentWrongInFirst10) wentWrongInFirst10++
      if (analysis.turningPoint.builtAdvantageThenLost) builtAdvantageThenLost++
    }
  }

  return { wonFromLosing, lostFromWinning, wentWrongInFirst10, builtAdvantageThenLost }
}

export function slugifyOpening(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50)
}

export function generateRecommendations(
  openings: OpeningStat[],
  endgame: EndgameAnalysis,
  turningPoints: TurningPointSummary,
): Recommendation[] {
  const recs: Recommendation[] = []

  for (const opening of openings) {
    if (opening.games >= 2 && opening.losses >= 2) {
      const lossRate = opening.losses / opening.games
      if (lossRate > 0.5) {
        const slug = slugifyOpening(opening.name)
        recs.push({
          title: `Train ${opening.name}`,
          description: `You lose ${opening.losses} of ${opening.games} games ${opening.perspective === 'played' ? 'playing' : 'facing'} the ${opening.name} (loss rate: ${(lossRate * 100).toFixed(0)}%). Train this opening with themed puzzles.`,
          puzzleLink: `/puzzles?set=${slug}`,
          severity: lossRate > 0.7 ? 'high' : 'medium',
        })
      }
    }
    if (opening.games >= 2 && opening.blunderRate > 0.1) {
      const slug = slugifyOpening(opening.name)
      recs.push({
        title: `Reduce blunders in ${opening.name}`,
        description: `Your blunder rate is ${(opening.blunderRate * 100).toFixed(0)}% in the ${opening.name}. Practice tactical puzzles from this opening.`,
        puzzleLink: `/puzzles?set=${slug}`,
        severity: opening.blunderRate > 0.2 ? 'high' : 'medium',
      })
    }
  }

  if (endgame.lostDrawnEndgames > 0) {
    recs.push({
      title: 'Train drawn endgames',
      description: `You lost ${endgame.lostDrawnEndgames} drawn endgame(s). These are positions Stockfish evaluates as equal that you went on to lose. Train endgame technique.`,
      puzzleLink: '/puzzles?set=endgame',
      severity: endgame.lostDrawnEndgames > 2 ? 'high' : 'medium',
    })
  }
  if (endgame.lostRookEndgames > 0) {
    recs.push({
      title: 'Train rook endgames',
      description: `You lost ${endgame.lostRookEndgames} rook endgame(s). Rook endgames are the most common type — train them specifically.`,
      puzzleLink: '/puzzles?set=endgame-rook',
      severity: endgame.lostRookEndgames > 2 ? 'high' : 'medium',
    })
  }
  if (endgame.endgameBlunders > 0) {
    recs.push({
      title: 'Reduce endgame blunders',
      description: `You committed ${endgame.endgameBlunders} blunder(s) in the endgame phase. Endgame precision is critical — small mistakes can turn wins into draws.`,
      puzzleLink: '/puzzles?set=endgame',
      severity: endgame.endgameBlunders > 3 ? 'high' : 'low',
    })
  }
  if (turningPoints.builtAdvantageThenLost > 0) {
    recs.push({
      title: 'Convert winning positions',
      description: `In ${turningPoints.builtAdvantageThenLost} game(s), you built an advantage in the first 10 moves but then lost it. Focus on converting advantages — train middlegame technique.`,
      puzzleLink: '/puzzles?set=middlegame',
      severity: turningPoints.builtAdvantageThenLost > 2 ? 'high' : 'medium',
    })
  }
  if (turningPoints.wentWrongInFirst10 > 0) {
    recs.push({
      title: 'Improve opening play',
      description: `In ${turningPoints.wentWrongInFirst10} game(s), you made significant mistakes in the first 10 moves. Study opening principles and common traps.`,
      puzzleLink: '/puzzles?set=opening',
      severity: turningPoints.wentWrongInFirst10 > 3 ? 'high' : 'medium',
    })
  }

  const severityOrder = { high: 0, medium: 1, low: 2 }
  recs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
  return recs
}

export function computeAverageAccuracy(analyses: GameAnalysis[]): number {
  let sum = 0
  let count = 0

  for (const analysis of analyses) {
    let gameAcc = 0
    let gameCount = 0

    for (let i = 0; i < analysis.game.moves.length; i++) {
      if (analysis.game.moves[i].color === analysis.userColor) {
        const before = analysis.evals[i] ?? { cp: 0 }
        const after = analysis.evals[i + 1] ?? analysis.evals[i] ?? { cp: 0 }
        const beforePct = povWinPercent(analysis.userColor, before)
        const afterPct = povWinPercent(analysis.userColor, after)
        gameAcc += accuracyFromWinPercents(beforePct, afterPct)
        gameCount++
      }
    }

    if (gameCount > 0) {
      sum += gameAcc / gameCount
      count++
    }
  }

  return count > 0 ? sum / count : 0
}

export function buildReport(analyses: GameAnalysis[]): WeaknessReport {
  const openings = aggregateOpenings(analyses)
  const endgame = aggregateEndgame(analyses)
  const turningPoints = aggregateTurningPoints(analyses)
  const openingBlunderRates = computeOpeningBlunderRates(analyses)
  const recommendations = generateRecommendations(openings, endgame, turningPoints)
  const averageAccuracy = computeAverageAccuracy(analyses)

  return {
    totalGames: analyses.length,
    completedGames: analyses.length,
    openings,
    endgame,
    turningPoints,
    openingBlunderRates,
    recommendations,
    averageAccuracy,
  }
}
