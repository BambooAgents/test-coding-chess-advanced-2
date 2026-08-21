/**
 * Analyze page — stage 1 core.
 *
 * Input modes: paste-PGN, chess.com username import, handoff from Play page.
 * Renders a read-only board + eval bar + move scrubber + move list with
 * the 6 eval-delta badges. Analysis runs progressively (move-by-move).
 *
 * Full fidelity (arrows, accuracy%, brilliant) is ticket #15.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { Position } from '../chess/Position'
import { parsePgn } from '../chess/pgn'
import { fetchChessComGames } from '../chess/chessCom'
import {
  CLASSIFICATION_GLYPHS,
  type EvalScore,
  type MoveClassification,
  type ParsedGame,
} from '../chess'
import { StockfishEngine } from '../engine/StockfishEngine'
import { analyzeGame, accuracyForGame, type AnalyzeEngine, type GameAnalysis } from '../analyze'
import { ChessBoard } from '../components/ChessBoard'
import { EvalBar } from '../components/EvalBar'

/** Adapter wrapping StockfishEngine as an AnalyzeEngine. */
function realEngine(engine: StockfishEngine): AnalyzeEngine {
  return {
    async evaluate(fen: string): Promise<EvalScore> {
      const result = await engine.getEvaluation(fen, 15)
      return { cp: result.score, mate: result.mate, depth: result.depth }
    },
    async evaluateAfter(fen: string): Promise<EvalScore> {
      // Must use the SAME depth as evaluate() so evalBefore/evalAfter deltas are
      // consistent. Using different depths (12 vs 8) produced noisy deltas that
      // marked top opening moves as inaccuracies. Depth 15 per spec §4.1.
      const result = await engine.getEvaluation(fen, 15)
      return { cp: result.score, mate: result.mate, depth: result.depth }
    },
    async bestMove(fen: string): Promise<string> {
      const result = await engine.getBestMove(fen, 12)
      return result.bestMove
    },
    // Real MultiPV N=2: uses engine.getMultiPv which sends
    // `setoption name MultiPV value 2` and parses the two PV lines.
    async multiPv2(fen: string): Promise<{ pv1: EvalScore; pv2: EvalScore }> {
      const lines = await engine.getMultiPv(fen, 12, 2)
      const toScore = (l: { cp?: number; mate?: number; depth?: number }): EvalScore => ({
        cp: l.cp,
        mate: l.mate,
        depth: l.depth,
      })
      return {
        pv1: toScore(lines[0]),
        pv2: toScore(lines[1]),
      }
    },
  }
}

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--sp-3);
  padding: var(--sp-3) 0;
`

const TopBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  align-items: flex-end;
`

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
  font-size: var(--fs-sm);
`

const TextInput = styled.input`
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  background: var(--bg);
  color: var(--text);
`

const TextArea = styled.textarea`
  width: 320px;
  height: 80px;
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--fs-xs);
  background: var(--bg);
  color: var(--text);
`

const Button = styled.button`
  padding: var(--sp-1) var(--sp-3);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  font-size: var(--fs-sm);
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`

const CancelBtn = styled.button`
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: var(--fs-sm);
  cursor: pointer;
`

const Select = styled.select`
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  background: var(--bg);
  color: var(--text);
`

const MainArea = styled.div`
  display: flex;
  gap: var(--sp-3);
  flex-wrap: wrap;
`

const BoardArea = styled.div`
  display: flex;
  gap: var(--sp-2);
`

const SidePanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-width: 280px;
`

const Scrubber = styled.div`
  display: flex;
  gap: var(--sp-1);
  align-items: center;
`

const ScrubBtn = styled.button`
  padding: var(--sp-1) var(--sp-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-size: var(--fs-sm);
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`

const MoveList = styled.div`
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  max-height: 360px;
  overflow-y: auto;
  background: var(--bg);
`

const MoveRow = styled.button<{ $current: boolean; $badge: string }>`
  display: grid;
  grid-template-columns: 32px 1fr 40px;
  width: 100%;
  gap: var(--sp-1);
  padding: var(--sp-1) var(--sp-2);
  border: none;
  border-bottom: 1px solid var(--border);
  background: ${(p) => (p.$current ? 'var(--accent-soft)' : 'transparent')};
  color: var(--text);
  cursor: pointer;
  text-align: left;
  font-size: var(--fs-sm);
  &:hover { background: var(--accent-soft); }
`

const Badge = styled.span<{ $kind: string }>`
  font-size: var(--fs-xs);
  font-weight: 600;
  color: ${(p) => badgeColor(p.$kind)};
`

function badgeColor(kind: string): string {
  switch (kind) {
    case 'brilliant': return '#a855f7' // purple — chess.com convention for brilliant
    case 'best': return '#16a34a'
    case 'great': return '#0ea5e9'
    case 'good': return '#84cc16'
    case 'book': return '#a3a3a3'
    case 'inaccuracy': return '#eab308'
    case 'mistake': return '#f97316'
    case 'blunder': return '#dc2626'
    default: return 'transparent' // 'no_annotation' has no glyph, transparent is correct
  }
}

const Status = styled.div`
  font-size: var(--fs-sm);
  color: var(--text-muted);
`

const OpeningName = styled.div`
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text);
`

export function AnalyzePage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [pgnInput, setPgnInput] = useState('')
  const [username, setUsername] = useState('')
  const [gameCount, setGameCount] = useState(20)
  const [loadingGames, setLoadingGames] = useState(false)
  const [chessComPgns, setChessComPgns] = useState<string[]>([])
  const [selectedGameIdx, setSelectedGameIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [game, setGame] = useState<ParsedGame | null>(null)
  const [analysis, setAnalysis] = useState<GameAnalysis | null>(null)
  const [currentPly, setCurrentPly] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const engineRef = useRef<StockfishEngine | null>(null)
  const cancelRef = useRef<boolean>(false)
  const moveListRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll the move list to keep the current ply visible.
  useEffect(() => {
    if (!moveListRef.current || currentPly === 0) return
    const row = moveListRef.current.querySelector<HTMLButtonElement>(
      `[data-ply="${currentPly}"]`,
    )
    if (row) row.scrollIntoView({ block: 'nearest' })
  }, [currentPly])

  // Handoff from Play page: router state carries a PGN.
  useEffect(() => {
    const state = location.state as { pgn?: string } | null
    if (state?.pgn) {
      loadPgn(state.pgn)
    } else {
      const pgnParam = searchParams.get('pgn')
      if (pgnParam) loadPgn(pgnParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Init engine once.
  useEffect(() => {
    const engine = new StockfishEngine()
    engineRef.current = engine
    engine.init().catch(() => setError('Engine failed to load — analysis unavailable.'))
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  const loadPgn = useCallback((pgn: string) => {
    try {
      const parsed = parsePgn(pgn)
      if (!parsed || parsed.moves.length === 0) {
        setError('No moves found in PGN.')
        return
      }
      setError(null)
      setGame(parsed)
      setAnalysis(null)
      setCurrentPly(0)
      setPgnInput(pgn) // reflect the loaded PGN in the textarea (handoff/import)
      void runAnalysis(parsed)
    } catch (e) {
      setError(`Failed to parse PGN: ${(e as Error).message}`)
    }
    // runAnalysis is stable (useCallback with empty-ish deps); safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runAnalysis = useCallback(async (g: ParsedGame) => {
    if (!engineRef.current) return
    cancelRef.current = false
    setAnalyzing(true)
    try {
      const engine = realEngine(engineRef.current)
      const cancelChecker = () => cancelRef.current
      await analyzeGame(g, engine, (partial) => setAnalysis({ ...partial }), cancelChecker)
      // Auto-advance to the first classified move so the eval bar, best-move
      // arrow, and badges are immediately visible after analysis completes.
      // (Without this the board sits at the starting position with no visual
      // feedback — a major UX defect that made the page look broken.)
      setCurrentPly(1)
    } catch (e) {
      setError(`Analysis failed: ${(e as Error).message}`)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const handleLoadChessCom = useCallback(async () => {
    if (!username.trim()) return
    setLoadingGames(true)
    setError(null)
    try {
      const games = await fetchChessComGames(username.trim(), { count: gameCount })
      if (games.length === 0) {
        setError('No games found for that username.')
        return
      }
      setChessComPgns(games.map((g) => g.pgn))
      setSelectedGameIdx(0)
      loadPgn(games[0].pgn)
    } catch (e) {
      setError(`Failed to load games: ${(e as Error).message}`)
    } finally {
      setLoadingGames(false)
    }
  }, [username, gameCount, loadPgn])

  // Current position from the game up to currentPly.
  const currentPosition = useMemo(() => {
    if (!game) return new Position()
    const pos = new Position(game.startingFen)
    for (let i = 0; i < currentPly && i < game.moves.length; i++) {
      try { pos.move(game.moves[i].uci) } catch { /* skip */ }
    }
    return pos
  }, [game, currentPly])

  const currentEval: EvalScore | null = useMemo(() => {
    if (!analysis || currentPly === 0) return null
    return analysis.moves[currentPly - 1]?.evalAfter ?? null
  }, [analysis, currentPly])

  const lastMove = useMemo(() => {
    if (!game || currentPly === 0) return null
    const m = game.moves[currentPly - 1]
    return { from: m.from, to: m.to }
  }, [game, currentPly])

  // Per-side accuracy % (computed once analysis is available).
  const accuracy = useMemo(() => {
    if (!analysis || analysis.moves.length === 0) return null
    return accuracyForGame(analysis)
  }, [analysis])

  // Best-move arrow for the current position: show the engine's best move
  // from the position BEFORE the current ply (what the player should have played).
  // Arrow for the last-played move (renders immediately from the game).
  // A true on-demand best-move arrow would require an engine call per scrub;
  // deferred to a refinement. This shows the move line for the current ply.
  const bestMoveArrow = useMemo(() => {
    if (!game || currentPly === 0) return []
    const m = game.moves[currentPly - 1]
    return [{ from: m.from, to: m.to, color: '#4f46e5' }]
  }, [game, currentPly])

  const movePairs = useMemo(() => {
    if (!game) return []
    const analyzed = analysis?.moves ?? []
    const pairs: { white?: { ply: number; san: string; classification: string }; black?: { ply: number; san: string; classification: string } }[] = []
    for (let i = 0; i < game.moves.length; i += 2) {
      const w = game.moves[i]
      const b = game.moves[i + 1]
      pairs.push({
        white: w ? { ply: i, san: w.san, classification: analyzed[i]?.classification ?? 'no_annotation' } : undefined,
        black: b ? { ply: i + 1, san: b.san, classification: analyzed[i + 1]?.classification ?? 'no_annotation' } : undefined,
      })
    }
    return pairs
  }, [game, analysis])

  const scrubTo = useCallback((ply: number) => {
    if (!game) return
    setCurrentPly(Math.max(0, Math.min(game.moves.length, ply)))
  }, [game])

  return (
    <Page>
      <TopBar>
        <InputGroup>
          <label>Paste PGN:</label>
          <TextArea
            data-testid="pgn-input"
            value={pgnInput}
            onChange={(e) => setPgnInput(e.target.value)}
            placeholder="1. e4 e5 2. ..."
          />
          <Button onClick={() => loadPgn(pgnInput)} disabled={!pgnInput.trim()}>
            Load PGN
          </Button>
        </InputGroup>

        <InputGroup>
          <label>chess.com username:</label>
          <TextInput
            data-testid="username-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="hikaru"
          />
          <div style={{ display: 'flex', gap: 'var(--sp-1)' }}>
            <Select
              data-testid="game-count"
              value={gameCount}
              onChange={(e) => setGameCount(Number(e.target.value))}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Select>
            <Button
              data-testid="load-games"
              onClick={handleLoadChessCom}
              disabled={loadingGames || !username.trim()}
            >
              {loadingGames ? 'Loading…' : 'Load games'}
            </Button>
          </div>
          {chessComPgns.length > 1 && (
            <Select
              value={selectedGameIdx}
              onChange={(e) => {
                const idx = Number(e.target.value)
                setSelectedGameIdx(idx)
                loadPgn(chessComPgns[idx])
              }}
            >
              {chessComPgns.map((_, i) => (
                <option key={i} value={i}>Game {i + 1}</option>
              ))}
            </Select>
          )}
        </InputGroup>
      </TopBar>

      {error && <Status role="alert" data-testid="analyze-error">{error}</Status>}
      {analyzing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <Status data-testid="analyzing">Analyzing… {analysis?.moves.length ?? 0}/{game?.moves.length ?? 0}</Status>
          <CancelBtn data-testid="cancel-analysis" onClick={() => { cancelRef.current = true }}>
            Cancel
          </CancelBtn>
        </div>
      )}

      {game && (
        <>
          <OpeningName>{game.headers.Opening || analysis?.openingName || 'Unknown opening'}</OpeningName>
          {accuracy && (accuracy.white !== null || accuracy.black !== null) && (
            <div data-testid="accuracy" style={{ display: 'flex', gap: 'var(--sp-3)', fontSize: 'var(--fs-sm)' }}>
              <span>White accuracy: <strong>{accuracy.white !== null ? `${accuracy.white}%` : '—'}</strong></span>
              <span>Black accuracy: <strong>{accuracy.black !== null ? `${accuracy.black}%` : '—'}</strong></span>
            </div>
          )}
          <MainArea>
            <BoardArea>
              <EvalBar evalScore={currentEval} />
              <ChessBoard
                position={currentPosition}
                orientation="white"
                onMove={() => false}
                disabled
                lastMove={lastMove}
                showCheck
                arrows={bestMoveArrow}
              />
            </BoardArea>

            <SidePanel>
              <Scrubber data-testid="scrubber">
                <ScrubBtn onClick={() => scrubTo(0)} disabled={currentPly === 0}>⏮</ScrubBtn>
                <ScrubBtn onClick={() => scrubTo(currentPly - 1)} disabled={currentPly === 0}>◀</ScrubBtn>
                <span>{currentPly} / {game.moves.length}</span>
                <ScrubBtn onClick={() => scrubTo(currentPly + 1)} disabled={currentPly >= game.moves.length}>▶</ScrubBtn>
                <ScrubBtn onClick={() => scrubTo(game.moves.length)} disabled={currentPly >= game.moves.length}>⏭</ScrubBtn>
              </Scrubber>

              <MoveList ref={moveListRef} data-testid="move-list">
                {movePairs.map((pair, i) => (
                  <div key={i} style={{ display: 'contents' }}>
                    {pair.white && (
                      <MoveRow
                        data-ply={pair.white.ply + 1}
                        $current={currentPly === pair.white.ply + 1}
                        $badge={pair.white.classification}
                        onClick={() => scrubTo(pair.white!.ply + 1)}
                      >
                        <span>{i + 1}.</span>
                        <span>{pair.white.san}</span>
                        <Badge $kind={pair.white.classification}>
                          {CLASSIFICATION_GLYPHS[pair.white.classification as MoveClassification]}
                        </Badge>
                      </MoveRow>
                    )}
                    {pair.black && (
                      <MoveRow
                        data-ply={pair.black.ply + 1}
                        $current={currentPly === pair.black.ply + 1}
                        $badge={pair.black.classification}
                        onClick={() => scrubTo(pair.black!.ply + 1)}
                      >
                        <span></span>
                        <span>{pair.black.san}</span>
                        <Badge $kind={pair.black.classification}>
                          {CLASSIFICATION_GLYPHS[pair.black.classification as MoveClassification]}
                        </Badge>
                      </MoveRow>
                    )}
                  </div>
                ))}
              </MoveList>
            </SidePanel>
          </MainArea>
        </>
      )}
    </Page>
  )
}
