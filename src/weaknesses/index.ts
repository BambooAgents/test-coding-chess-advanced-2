/**
 * Weaknesses module — barrel export.
 */

export type {
  AnalysisOptions,
  GameAnalysis,
  TurningPoint,
  WeaknessReport,
  OpeningStat,
  EndgameAnalysis,
  TurningPointSummary,
  OpeningBlunderRate,
  Recommendation,
} from './types'

export {
  getUserResult,
  getOpening,
  getEco,
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
} from './analysis'

export type {
  EngineAdapter,
  AnalysisResult,
} from './engineAdapter'

export {
  createRealEngineAdapter,
  createMockEngineAdapter,
  analyzeGameEvals,
} from './engineAdapter'
