/**
 * Engine analysis wrapper — wraps StockfishEngine to return full EvalScore
 * (including mate scores) per position.
 */

import type { EvalScore } from '../chess/types'
import type { StockfishResult } from '../engine/StockfishEngine'

export interface AnalysisResult extends StockfishResult {
  cp?: number
  mate?: number
}

export interface EngineAdapter {
  getEval(fen: string, depth: number): Promise<AnalysisResult>
  init(): Promise<void>
  destroy(): void
}

export function createRealEngineAdapter(
  engine: import('../engine/StockfishEngine').StockfishEngine,
): EngineAdapter {
  return {
    async init() {
      await engine.init()
    },
    async getEval(fen: string, depth: number): Promise<AnalysisResult> {
      const result = await engine.getEvaluation(fen, depth)
      return {
        ...result,
        cp: result.score,
        mate: result.mate,
      }
    },
    destroy() {
      engine.destroy()
    },
  }
}

export function createMockEngineAdapter(
  evalMap: Map<string, AnalysisResult>,
): EngineAdapter {
  return {
    async init() {},
    async getEval(fen: string): Promise<AnalysisResult> {
      const exact = evalMap.get(fen)
      if (exact) return exact
      const boardPart = fen.split(' ')[0]
      for (const [key, val] of evalMap) {
        if (key.split(' ')[0] === boardPart) return val
      }
      return { bestMove: 'e2e4', cp: 0, depth: 6 }
    },
    destroy() {},
  }
}

export async function analyzeGameEvals(
  startingFen: string,
  uciMoves: string[],
  engine: EngineAdapter,
  depth: number,
): Promise<EvalScore[]> {
  const evals: EvalScore[] = []
  const { Position } = await import('../chess/Position')
  const position = new Position(startingFen)

  const startPosEval = await engine.getEval(position.fen(), depth)
  evals.push(toEvalScore(startPosEval))

  for (const uci of uciMoves) {
    position.move(uci)
    const evalResult = await engine.getEval(position.fen(), depth)
    evals.push(toEvalScore(evalResult))
  }

  return evals
}

function toEvalScore(result: AnalysisResult): EvalScore {
  return {
    cp: result.cp,
    mate: result.mate,
    depth: result.depth,
  }
}
