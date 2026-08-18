/**
 * Types for the weakness analysis engine.
 */

import type { Color, GamePhase, MoveClassification, ParsedGame, EvalScore } from '../chess/types'

export interface AnalysisOptions {
  username: string
  gameCount: number
  depth?: number
}

export interface GameAnalysis {
  index: number
  game: ParsedGame
  userColor: Color
  opening: string
  eco: string
  userResult: 'win' | 'loss' | 'draw'
  evals: EvalScore[]
  classifications: MoveClassification[]
  phases: GamePhase[]
  turningPoint: TurningPoint | null
  endgameBlunders: number
  totalBlunders: number
  totalInaccuracies: number
  totalMistakes: number
  lostDrawnEndgame: boolean
  lostRookEndgame: boolean
}

export interface TurningPoint {
  wonFromLosing: boolean
  lostFromWinning: boolean
  wentWrongInFirst10: boolean
  builtAdvantageThenLost: boolean
  turningPly: number | null
}

export interface WeaknessReport {
  totalGames: number
  completedGames: number
  openings: OpeningStat[]
  endgame: EndgameAnalysis
  turningPoints: TurningPointSummary
  openingBlunderRates: OpeningBlunderRate[]
  recommendations: Recommendation[]
  averageAccuracy: number
}

export interface OpeningStat {
  name: string
  eco: string
  games: number
  wins: number
  losses: number
  draws: number
  perspective: 'played' | 'faced'
  blunderRate: number
  accuracy: number
}

export interface EndgameAnalysis {
  endgameGames: number
  endgameBlunders: number
  lostDrawnEndgames: number
  lostRookEndgames: number
  endgameAccuracy: number
}

export interface TurningPointSummary {
  wonFromLosing: number
  lostFromWinning: number
  wentWrongInFirst10: number
  builtAdvantageThenLost: number
}

export interface OpeningBlunderRate {
  name: string
  eco: string
  blunderRate: number
  userMoves: number
  blunders: number
  perspective: 'played' | 'faced'
}

export interface Recommendation {
  title: string
  description: string
  puzzleLink: string
  severity: 'high' | 'medium' | 'low'
}
