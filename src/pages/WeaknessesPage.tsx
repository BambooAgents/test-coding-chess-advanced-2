import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { fetchChessComGames } from '../chess/chessCom'
import { parsePgn } from '../chess/pgn'
import { StockfishEngine } from '../engine/StockfishEngine'
import {
  createRealEngineAdapter,
  analyzeGameEvals,
  analyzeGame,
  buildReport,
} from '../weaknesses'
import type {
  GameAnalysis,
  WeaknessReport,
} from '../weaknesses'
import type { Color } from '../chess/types'

const Container = styled.div`
  max-width: 1000px;
  margin: 0 auto;
`

const Title = styled.h1`
  font-size: var(--fs-3xl);
  font-weight: 700;
  margin-bottom: var(--sp-4);
  color: var(--text);
`

const Subtitle = styled.p`
  font-size: var(--fs-lg);
  color: var(--text-muted);
  margin-bottom: var(--sp-8);
`

const InputForm = styled.div`
  display: flex;
  gap: var(--sp-4);
  margin-bottom: var(--sp-8);
  flex-wrap: wrap;
  align-items: flex-end;
`

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--sp-1);
`

const Label = styled.label`
  font-size: var(--fs-sm);
  color: var(--text-muted);
  font-weight: 500;
`

const TextInput = styled.input`
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--sp-2) var(--sp-4);
  color: var(--text);
  font-size: var(--fs-base);
  width: 240px;

  &:focus {
    outline: none;
    border-color: var(--accent);
  }
`

const Select = styled.select`
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--sp-2) var(--sp-4);
  color: var(--text);
  font-size: var(--fs-base);
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--accent);
  }
`

const Button = styled.button`
  background: var(--accent);
  color: white;
  padding: var(--sp-2) var(--sp-6);
  font-size: var(--fs-base);
  font-weight: 600;

  &:hover {
    background: var(--accent-hover);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: var(--bg-elevated);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-bottom: var(--sp-4);
`

const ProgressFill = styled.div<{ $progress: number }>`
  width: ${($p) => $p.$progress}%;
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
`

const ProgressText = styled.p`
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin-bottom: var(--sp-8);
`

const ErrorAlert = styled.div`
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--danger);
  border-radius: var(--radius-md);
  padding: var(--sp-4);
  color: var(--danger);
  margin-bottom: var(--sp-8);
`

const Section = styled.section`
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-6);
  margin-bottom: var(--sp-6);
`

const SectionTitle = styled.h2`
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--sp-4);
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    padding: var(--sp-2) var(--sp-3);
    color: var(--text-muted);
    font-size: var(--fs-sm);
    font-weight: 500;
    border-bottom: 1px solid var(--border);
  }

  td {
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--border);
    font-size: var(--fs-sm);
    color: var(--text);
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: var(--bg-elevated);
  }
`

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--sp-4);
`

const StatCard = styled.div`
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--sp-4);
  text-align: center;
`

const StatValue = styled.div`
  font-size: var(--fs-2xl);
  font-weight: 700;
  color: var(--accent);
`

const StatLabel = styled.div`
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin-top: var(--sp-1);
`

const RecCard = styled.div<{ $severity: string }>`
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--sp-4);
  margin-bottom: var(--sp-3);
  border-left: 4px solid ${($p) =>
    $p.$severity === 'high' ? 'var(--danger)' : $p.$severity === 'medium' ? 'var(--warning)' : 'var(--success)'};
`

const RecTitle = styled.h3`
  font-size: var(--fs-base);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--sp-1);
`

const RecDesc = styled.p`
  font-size: var(--fs-sm);
  color: var(--text-muted);
  margin-bottom: var(--sp-2);
`

const RecLink = styled(Link)`
  display: inline-block;
  padding: var(--sp-1) var(--sp-3);
  background: var(--accent-light);
  color: var(--accent);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  font-weight: 500;

  &:hover {
    background: var(--accent);
    color: white;
  }
`

const SeverityBadge = styled.span<{ $severity: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-xs);
  font-weight: 600;
  margin-left: var(--sp-2);
  background: ${($p) =>
    $p.$severity === 'high' ? 'rgba(239, 68, 68, 0.2)' :
    $p.$severity === 'medium' ? 'rgba(245, 158, 11, 0.2)' :
    'rgba(34, 197, 94, 0.2)'};
  color: ${($p) =>
    $p.$severity === 'high' ? 'var(--danger)' :
    $p.$severity === 'medium' ? 'var(--warning)' :
    'var(--success)'};
`

const LoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: var(--sp-2);

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`

type AnalysisState = 'idle' | 'fetching' | 'analyzing' | 'done' | 'error'

export function WeaknessesPage() {
  const [username, setUsername] = useState('')
  const [gameCount, setGameCount] = useState(50)
  const [state, setState] = useState<AnalysisState>('idle')
  const [error, setError] = useState('')
  const [completedGames, setCompletedGames] = useState(0)
  const [totalGames, setTotalGames] = useState(0)
  const [report, setReport] = useState<WeaknessReport | null>(null)
  const [partialAnalyses, setPartialAnalyses] = useState<GameAnalysis[]>([])
  const engineRef = useRef<StockfishEngine | null>(null)

  useEffect(() => {
    if (partialAnalyses.length > 0 && state === 'analyzing') {
      const partialReport = buildReport(partialAnalyses)
      partialReport.completedGames = partialAnalyses.length
      partialReport.totalGames = totalGames
      setReport(partialReport)
    }
  }, [partialAnalyses, state, totalGames])

  const runAnalysis = useCallback(async () => {
    if (!username.trim()) {
      setError('Please enter a chess.com username')
      setState('error')
      return
    }

    setState('fetching')
    setError('')
    setReport(null)
    setPartialAnalyses([])
    setCompletedGames(0)
    setTotalGames(0)

    try {
      const games = await fetchChessComGames(username.trim(), { count: gameCount })
      setTotalGames(games.length)

      if (games.length === 0) {
        setError('No games found for this username')
        setState('error')
        return
      }

      setState('analyzing')

      const engine = new StockfishEngine()
      engineRef.current = engine
      const adapter = createRealEngineAdapter(engine)
      await adapter.init()

      const analyses: GameAnalysis[] = []
      const depth = 6

      for (let i = 0; i < games.length; i++) {
        const gameData = games[i]
        const parsed = parsePgn(gameData.pgn)

        if (parsed.moves.length === 0) continue

        const userColor: Color = gameData.playerColor || 'white'

        const uciMoves = parsed.moves.map((m) => m.uci)
        const evals = await analyzeGameEvals(parsed.startingFen, uciMoves, adapter, depth)

        const analysis = analyzeGame(parsed, userColor, evals)
        analysis.index = i
        analyses.push(analysis)

        setPartialAnalyses((prev) => [...prev, analysis])
        setCompletedGames(i + 1)
      }

      adapter.destroy()
      engineRef.current = null

      const finalReport = buildReport(analyses)
      finalReport.completedGames = analyses.length
      finalReport.totalGames = analyses.length
      setReport(finalReport)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
      setState('error')
      if (engineRef.current) {
        engineRef.current.destroy()
        engineRef.current = null
      }
    }
  }, [username, gameCount])

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy()
        engineRef.current = null
      }
    }
  }, [])

  const progress = totalGames > 0 ? (completedGames / totalGames) * 100 : 0

  return (
    <Container>
      <Title>My Weaknesses</Title>
      <Subtitle>
        Enter your chess.com username to get a live analysis of your weak spots —
        openings, endgames, and what to train.
      </Subtitle>

      <InputForm>
        <InputGroup>
          <Label htmlFor="username">Chess.com Username</Label>
          <TextInput
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. hikaru"
            disabled={state === 'fetching' || state === 'analyzing'}
          />
        </InputGroup>
        <InputGroup>
          <Label htmlFor="gameCount">Games to Analyze</Label>
          <Select
            id="gameCount"
            value={gameCount}
            onChange={(e) => setGameCount(Number(e.target.value))}
            disabled={state === 'fetching' || state === 'analyzing'}
          >
            <option value={20}>20 games</option>
            <option value={50}>50 games</option>
            <option value={100}>100 games</option>
          </Select>
        </InputGroup>
        <Button
          onClick={runAnalysis}
          disabled={state === 'fetching' || state === 'analyzing'}
        >
          {state === 'fetching' || state === 'analyzing' ? (
            <>
              <LoadingSpinner />
              {state === 'fetching' ? 'Fetching...' : 'Analyzing...'}
            </>
          ) : (
            'Analyze'
          )}
        </Button>
      </InputForm>

      {state === 'error' && <ErrorAlert>{error}</ErrorAlert>}

      {(state === 'analyzing' || state === 'done') && totalGames > 0 && (
        <>
          <ProgressBar>
            <ProgressFill $progress={progress} />
          </ProgressBar>
          <ProgressText>
            {state === 'analyzing'
              ? `Analyzing game ${completedGames} of ${totalGames}...`
              : `Analysis complete: ${completedGames} game${completedGames !== 1 ? 's' : ''} analyzed`}
          </ProgressText>
        </>
      )}

      {report && (state === 'analyzing' || state === 'done') && (
        <>
          {report.recommendations.length > 0 && (
            <Section>
              <SectionTitle>Recommendations</SectionTitle>
              {report.recommendations.map((rec, i) => (
                <RecCard key={i} $severity={rec.severity}>
                  <RecTitle>
                    {rec.title}
                    <SeverityBadge $severity={rec.severity}>
                      {rec.severity.toUpperCase()}
                    </SeverityBadge>
                  </RecTitle>
                  <RecDesc>{rec.description}</RecDesc>
                  <RecLink to={rec.puzzleLink}>Train →</RecLink>
                </RecCard>
              ))}
            </Section>
          )}

          <Section>
            <SectionTitle>Overview</SectionTitle>
            <StatGrid>
              <StatCard>
                <StatValue>{report.completedGames}</StatValue>
                <StatLabel>Games Analyzed</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.averageAccuracy.toFixed(1)}%</StatValue>
                <StatLabel>Average Accuracy</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.turningPoints.wonFromLosing}</StatValue>
                <StatLabel>Won from Losing</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.turningPoints.lostFromWinning}</StatValue>
                <StatLabel>Lost from Winning</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.turningPoints.builtAdvantageThenLost}</StatValue>
                <StatLabel>Advantage Then Lost</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.turningPoints.wentWrongInFirst10}</StatValue>
                <StatLabel>Went Wrong Early</StatLabel>
              </StatCard>
            </StatGrid>
          </Section>

          {report.openings.length > 0 && (
            <Section>
              <SectionTitle>Openings</SectionTitle>
              <Table>
                <thead>
                  <tr>
                    <th>Opening</th>
                    <th>ECO</th>
                    <th>Type</th>
                    <th>Games</th>
                    <th>W</th>
                    <th>L</th>
                    <th>D</th>
                    <th>Blunder %</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {report.openings.map((op, i) => (
                    <tr key={i}>
                      <td>{op.name}</td>
                      <td>{op.eco}</td>
                      <td>{op.perspective}</td>
                      <td>{op.games}</td>
                      <td style={{ color: 'var(--success)' }}>{op.wins}</td>
                      <td style={{ color: 'var(--danger)' }}>{op.losses}</td>
                      <td>{op.draws}</td>
                      <td>{(op.blunderRate * 100).toFixed(1)}%</td>
                      <td>{op.accuracy.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Section>
          )}

          <Section>
            <SectionTitle>Endgame</SectionTitle>
            <StatGrid>
              <StatCard>
                <StatValue>{report.endgame.endgameGames}</StatValue>
                <StatLabel>Endgame Games</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.endgame.endgameBlunders}</StatValue>
                <StatLabel>Endgame Blunders</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.endgame.lostDrawnEndgames}</StatValue>
                <StatLabel>Lost Drawn Endgames</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.endgame.lostRookEndgames}</StatValue>
                <StatLabel>Lost Rook Endgames</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>{report.endgame.endgameAccuracy.toFixed(1)}%</StatValue>
                <StatLabel>Endgame Accuracy</StatLabel>
              </StatCard>
            </StatGrid>
          </Section>
        </>
      )}
    </Container>
  )
}
