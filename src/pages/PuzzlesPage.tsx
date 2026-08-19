/**
 * Puzzles page — plain puzzles + themed opening/endgame sets.
 *
 * Stage 1 of the puzzles feature:
 * - (P1) Plain puzzles: serve → solve → next, streak/score
 * - (P4) Themed sets: endgame-specific and opening-specific puzzle streams
 *
 * Session-only stats (localStorage). No rush/death-match (that's #18).
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import styled from 'styled-components'
import { ChessBoard } from '../components/ChessBoard'
import {
  getPuzzleIndex,
  getAllPuzzles,
  getPuzzleCount,
} from '../puzzles/data'
import {
  createSession,
  startPuzzle,
  tryMove,
  stepSolution,
  loadStats,
  shuffle,
  getEndgamePuzzles,
  getByTheme,
  getByOpening,
  createRushSession,
  startRush,
  rushCorrect,
  rushWrong,
  rushTick,
  createDeathMatchSession,
  startDeathMatch,
  dmCorrect,
  dmWrong,
  pickNextPuzzle,
} from '../puzzles'
import { Position } from '../chess'
import type { Puzzle, PuzzleStats, PuzzleSessionState, RushSession, DeathMatchSession } from '../puzzles'

// --- Styled components ---

const Page = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--sp-6);
`

const Title = styled.h1`
  font-size: var(--fs-2xl);
  font-weight: 700;
  color: var(--text);
`

const Layout = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--sp-8);
  align-items: start;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`

const BoardArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--sp-4);
`

const SidePanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
  min-width: 280px;
`

const StatsBar = styled.div`
  display: flex;
  gap: var(--sp-4);
  padding: var(--sp-3) var(--sp-4);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
`

const Stat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
`

const StatValue = styled.span`
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--accent);
`

const StatLabel = styled.span`
  color: var(--text-muted);
  font-size: var(--fs-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
`

const PuzzleInfo = styled.div`
  padding: var(--sp-4);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
`

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
`

const InfoLabel = styled.span`
  color: var(--text-muted);
`

const InfoValue = styled.span`
  color: var(--text);
  font-weight: 500;
`

const ModeSelector = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  padding: var(--sp-3);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
`

const ModeButton = styled.button<{ $active: boolean }>`
  background: ${(props) => (props.$active ? 'var(--accent)' : 'var(--bg-elevated)')};
  color: ${(props) => (props.$active ? 'white' : 'var(--text-muted)')};
  border: 1px solid ${(props) => (props.$active ? 'var(--accent)' : 'var(--border)')};
  padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--accent);
    color: ${(props) => (props.$active ? 'white' : 'var(--accent)')};
  }
`

const ThemeSelector = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  padding: var(--sp-3);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
`

const ThemeGroupTitle = styled.div`
  font-size: var(--fs-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  margin-top: var(--sp-2);
  &:first-child { margin-top: 0; }
`

const ThemeChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
`

const ThemeChip = styled.button<{ $active: boolean }>`
  background: ${(props) => (props.$active ? 'var(--accent-light)' : 'var(--bg-elevated)')};
  color: ${(props) => (props.$active ? 'var(--accent)' : 'var(--text-muted)')};
  border: 1px solid ${(props) => (props.$active ? 'var(--accent)' : 'var(--border)')};
  padding: var(--sp-1) var(--sp-2);
  border-radius: var(--radius-sm);
  font-size: var(--fs-xs);
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--accent);
  }
`

const FeedbackArea = styled.div`
  padding: var(--sp-3) var(--sp-4);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  font-weight: 500;
  text-align: center;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
`

const CorrectFeedback = styled(FeedbackArea)`
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
  border: 1px solid var(--success);
`

const WrongFeedback = styled(FeedbackArea)`
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
  border: 1px solid var(--danger);
`

const NeutralFeedback = styled(FeedbackArea)`
  background: var(--bg-surface);
  color: var(--text-muted);
  border: 1px solid var(--border);
`

const ActionButtons = styled.div`
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
`

const ActionButton = styled.button`
  background: var(--bg-elevated);
  color: var(--text);
  border: 1px solid var(--border);
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const PrimaryButton = styled(ActionButton)`
  background: var(--accent);
  color: white;
  border-color: var(--accent);

  &:hover {
    background: var(--accent-hover);
    color: white;
  }
`

// --- Component ---

type PuzzleMode = 'plain' | 'themed' | 'rush' | 'deathmatch'

export function PuzzlesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [mode, setMode] = useState<PuzzleMode>('plain')
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
  const [themeType, setThemeType] = useState<'endgame' | 'opening' | null>(null)
  const [session, setSession] = useState<PuzzleSessionState>(createSession())
  const [rushSession, setRushSession] = useState<RushSession>(createRushSession())
  const [dmSession, setDmSession] = useState<DeathMatchSession>(createDeathMatchSession())
  const [seenPuzzleIds, setSeenPuzzleIds] = useState<Set<string>>(new Set())
  const [stats, setStats] = useState<PuzzleStats>(loadStats())
  const [puzzleQueue, setPuzzleQueue] = useState<Puzzle[]>([])
  const [queueIndex, setQueueIndex] = useState(0)
  const [feedback, setFeedback] = useState<'none' | 'correct' | 'wrong' | 'solved'>('none')

  const index = useMemo(() => getPuzzleIndex(), [])

  // Consume ?set=<slug> from the URL (linked from the My Weaknesses page recommendations).
  // Slugs are lowercase-hyphenated; reverse-map to the opening tag or theme name.
  useEffect(() => {
    const set = searchParams.get('set')
    if (!set) return
    // Special-cased slugs from the recommendations.
    if (set === 'endgame' || set.startsWith('endgame-')) {
      setMode('themed')
      setThemeType('endgame')
      // 'endgame' → all endgames; 'endgame-rook' → rookEndgame, etc.
      if (set === 'endgame') {
        setSelectedTheme('all-endgames')
      } else {
        const sub = set.replace('endgame-', '')
        // find a theme whose slugified name matches (e.g. rook → rookEndgame)
        const match = index.themes.find((t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').includes(sub))
        setSelectedTheme(match ?? 'all-endgames')
      }
    } else if (set === 'opening') {
      setMode('themed')
      setThemeType('opening')
      setSelectedTheme(null) // no specific opening — let user pick
    } else if (set === 'middlegame') {
      setMode('themed')
      setThemeType('endgame') // middlegame isn't an endgame; fall back to a theme match
      const match = index.themes.find((t) => t.toLowerCase() === 'middlegame')
      setSelectedTheme(match ?? 'all-endgames')
    } else {
      // Otherwise treat as an opening slug (e.g. 'sicilian-defense' → 'Sicilian_Defense')
      const unslug = set.replace(/-/g, '_')
      const match = index.openings.find((o) => o.toLowerCase().replace(/[^a-z0-9]+/g, '-') === set || o === unslug || o.toLowerCase() === unslug.toLowerCase())
      if (match) {
        setMode('themed')
        setThemeType('opening')
        setSelectedTheme(match)
      }
    }
    // Clear the param so a manual visit to /puzzles starts plain.
    setSearchParams({}, { replace: true })
  }, [searchParams, index, setSearchParams])

  // Build puzzle queue when mode/theme changes
  useEffect(() => {
    let puzzles: Puzzle[] = []
    if (mode === 'plain') {
      puzzles = shuffle(getAllPuzzles())
    } else if (mode === 'themed' && selectedTheme) {
      if (themeType === 'endgame') {
        if (selectedTheme === 'all-endgames') {
          puzzles = shuffle(getEndgamePuzzles(index))
        } else {
          puzzles = shuffle(getByTheme(index, selectedTheme))
        }
      } else if (themeType === 'opening') {
        puzzles = shuffle(getByOpening(index, selectedTheme))
      }
    }
    if (puzzles.length > 0) {
      setPuzzleQueue(puzzles)
      setQueueIndex(0)
      const s = startPuzzle(createSession(), puzzles[0])
      setSession(s)
      setFeedback('none')
    }
  }, [mode, selectedTheme, themeType, index])

  // Sync stats when session stats change
  useEffect(() => {
    setStats(session.stats)
  }, [session.stats])

  const handleMove = useCallback((uci: string): boolean => {
    const result = tryMove(session, uci)
    if (result.correct) {
      if (result.session.state === 'solved') {
        setFeedback('solved')
      } else {
        setFeedback('correct')
      }
    } else {
      setFeedback('wrong')
    }
    setSession(result.session)
    return result.correct
  }, [session])

  const handleNext = useCallback(() => {
    const nextIndex = queueIndex + 1
    if (nextIndex < puzzleQueue.length) {
      const s = startPuzzle(session, puzzleQueue[nextIndex])
      setSession(s)
      setQueueIndex(nextIndex)
      setFeedback('none')
    } else {
      // Reshuffle and start over
      const reshuffled = shuffle(puzzleQueue)
      setPuzzleQueue(reshuffled)
      setQueueIndex(0)
      const s = startPuzzle(session, reshuffled[0])
      setSession(s)
      setFeedback('none')
    }
  }, [queueIndex, puzzleQueue, session])

  const handleShowSolution = useCallback(() => {
    const stepped = stepSolution(session)
    setSession(stepped)
  }, [session])

  const handleRetry = useCallback(() => {
    if (!session.puzzle) return
    const s = startPuzzle(session, session.puzzle)
    setSession(s)
    setFeedback('none')
  }, [session])

  // --- Rush / Death-Match handlers ---
  const allPuzzles = useMemo(() => getAllPuzzles(), [])

  const loadNextRushPuzzle = useCallback((rs: RushSession) => {
    if (rs.state !== 'playing') return
    const next = pickNextPuzzle(allPuzzles, rs.ratingFloor, seenPuzzleIds)
    if (next) {
      setSeenPuzzleIds((prev) => new Set(prev).add(next.id))
      setSession(startPuzzle(createSession(), next))
      setRushSession({ ...rs, currentPuzzle: next })
      setFeedback('none')
    }
  }, [allPuzzles, seenPuzzleIds])

  const loadNextDmPuzzle = useCallback((ds: DeathMatchSession) => {
    if (ds.state !== 'playing') return
    const next = pickNextPuzzle(allPuzzles, ds.ratingFloor, seenPuzzleIds)
    if (next) {
      setSeenPuzzleIds((prev) => new Set(prev).add(next.id))
      setSession(startPuzzle(createSession(), next))
      setDmSession({ ...ds, currentPuzzle: next })
      setFeedback('none')
    }
  }, [allPuzzles, seenPuzzleIds])

  const handleStartRush = useCallback(() => {
    const rs = startRush(180)
    setRushSession(rs)
    setSeenPuzzleIds(new Set())
    loadNextRushPuzzle(rs)
  }, [loadNextRushPuzzle])

  const handleStartDeathMatch = useCallback(() => {
    const ds = startDeathMatch()
    setDmSession(ds)
    setSeenPuzzleIds(new Set())
    loadNextDmPuzzle(ds)
  }, [loadNextDmPuzzle])

  // Rush move handler: correct → next puzzle; wrong → count, 3 = finish.
  const handleRushMove = useCallback((uci: string): boolean => {
    const result = tryMove(session, uci)
    if (result.correct) {
      if (result.session.state === 'solved') {
        const rs = rushCorrect(rushSession)
        setRushSession(rs)
        setFeedback('solved')
        loadNextRushPuzzle(rs)
      } else {
        setSession(result.session)
        setFeedback('correct')
      }
    } else {
      const rs = rushWrong(rushSession)
      setRushSession(rs)
      setFeedback('wrong')
      if (rs.state === 'finished') {
        setSession(createSession())
      } else {
        loadNextRushPuzzle(rs)
      }
    }
    return result.correct
  }, [session, rushSession, loadNextRushPuzzle])

  // Death-Match move handler.
  const handleDmMove = useCallback((uci: string): boolean => {
    const result = tryMove(session, uci)
    if (result.correct) {
      if (result.session.state === 'solved') {
        const ds = dmCorrect(dmSession)
        setDmSession(ds)
        setFeedback('solved')
        loadNextDmPuzzle(ds)
      } else {
        setSession(result.session)
        setFeedback('correct')
      }
    } else {
      const ds = dmWrong(dmSession)
      setDmSession(ds)
      setFeedback('wrong')
      if (ds.state === 'finished') {
        setSession(createSession())
      } else {
        loadNextDmPuzzle(ds)
      }
    }
    return result.correct
  }, [session, dmSession, loadNextDmPuzzle])

  // Rush timer: tick every second while playing.
  useEffect(() => {
    if (mode !== 'rush' || rushSession.state !== 'playing') return
    const id = setInterval(() => {
      setRushSession((prev) => {
        const next = rushTick(prev, 1)
        if (next.state === 'finished') {
          clearInterval(id)
        }
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [mode, rushSession.state])

  // Get endgame theme names
  const endgameThemes = useMemo(() => {
    return index.themes.filter((t) =>
      t.toLowerCase().includes('endgame') || t === 'advancedPawn',
    )
  }, [index])

  // Get opening tag names
  const openingTags = useMemo(() => index.openings, [index])

  // The user's color for the current puzzle
  const userColor = session.userColor
  const currentPuzzle = session.puzzle
  // Derive a Position for the ChessBoard (which takes a Position, not a FEN).
  const currentPosition = useMemo(
    () => (session.currentFen ? new Position(session.currentFen) : new Position()),
    [session.currentFen],
  )
  const lastBoardMove = null

  return (
    <Page>
      <Title>🧩 Puzzles</Title>

      <ModeSelector>
        <ModeButton $active={mode === 'plain'} onClick={() => { setMode('plain'); setSelectedTheme(null); setThemeType(null) }}>
          Plain Puzzles
        </ModeButton>
        <ModeButton $active={mode === 'themed'} onClick={() => { setMode('themed'); setThemeType('endgame'); setSelectedTheme('all-endgames') }}>
          Themed Sets
        </ModeButton>
        <ModeButton $active={mode === 'rush'} onClick={() => setMode('rush')} data-testid="mode-rush">
          Rush
        </ModeButton>
        <ModeButton $active={mode === 'deathmatch'} onClick={() => setMode('deathmatch')} data-testid="mode-deathmatch">
          Death Match
        </ModeButton>
      </ModeSelector>

      {mode === 'themed' && (
        <ThemeSelector>
          <ThemeGroupTitle>Endgame Sets</ThemeGroupTitle>
          <ThemeChips>
            <ThemeChip
              $active={themeType === 'endgame' && selectedTheme === 'all-endgames'}
              onClick={() => { setThemeType('endgame'); setSelectedTheme('all-endgames') }}
            >
              All Endgames
            </ThemeChip>
            {endgameThemes.map((theme) => (
              <ThemeChip
                key={theme}
                $active={themeType === 'endgame' && selectedTheme === theme}
                onClick={() => { setThemeType('endgame'); setSelectedTheme(theme) }}
              >
                {theme.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}
              </ThemeChip>
            ))}
          </ThemeChips>

          <ThemeGroupTitle>Opening Sets</ThemeGroupTitle>
          <ThemeChips>
            {openingTags.map((opening) => (
              <ThemeChip
                key={opening}
                $active={themeType === 'opening' && selectedTheme === opening}
                onClick={() => { setThemeType('opening'); setSelectedTheme(opening) }}
              >
                {opening.replace(/_/g, ' ')}
              </ThemeChip>
            ))}
          </ThemeChips>
        </ThemeSelector>
      )}

      <StatsBar>
        <Stat>
          <StatValue>{stats.streak}</StatValue>
          <StatLabel>Streak</StatLabel>
        </Stat>
        <Stat>
          <StatValue>{stats.bestStreak}</StatValue>
          <StatLabel>Best</StatLabel>
        </Stat>
        <Stat>
          <StatValue>{stats.solved}</StatValue>
          <StatLabel>Solved</StatLabel>
        </Stat>
        <Stat>
          <StatValue>{stats.failed}</StatValue>
          <StatLabel>Failed</StatLabel>
        </Stat>
        <Stat>
          <StatValue>{getPuzzleCount()}</StatValue>
          <StatLabel>Available</StatLabel>
        </Stat>
      </StatsBar>

      {mode === 'rush' && (
        <div data-testid="rush-panel" style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          {rushSession.state === 'idle' ? (
            <PrimaryButton data-testid="start-rush" onClick={handleStartRush}>Start Rush (3:00)</PrimaryButton>
          ) : (
            <>
              <Stat>
                <StatValue data-testid="rush-time">{Math.floor(rushSession.timeLeft / 60)}:{String(rushSession.timeLeft % 60).padStart(2, '0')}</StatValue>
                <StatLabel>Time</StatLabel>
              </Stat>
              <Stat>
                <StatValue data-testid="rush-score">{rushSession.solved}</StatValue>
                <StatLabel>Solved</StatLabel>
              </Stat>
              <Stat>
                <StatValue data-testid="rush-wrong">{rushSession.wrongCount}/3</StatValue>
                <StatLabel>Wrong</StatLabel>
              </Stat>
              {rushSession.state === 'finished' && (
                <div data-testid="rush-finished">
                  Rush over! Score: {rushSession.solved}{' '}
                  <PrimaryButton onClick={handleStartRush}>Play Again</PrimaryButton>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {mode === 'deathmatch' && (
        <div data-testid="deathmatch-panel" style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center', flexWrap: 'wrap' }}>
          {dmSession.state === 'idle' ? (
            <PrimaryButton data-testid="start-dm" onClick={handleStartDeathMatch}>Start Death Match</PrimaryButton>
          ) : (
            <>
              <Stat>
                <StatValue data-testid="dm-lives">{'❤'.repeat(Math.max(0, dmSession.lives))}</StatValue>
                <StatLabel>Lives</StatLabel>
              </Stat>
              <Stat>
                <StatValue data-testid="dm-score">{dmSession.solved}</StatValue>
                <StatLabel>Solved</StatLabel>
              </Stat>
              <Stat>
                <StatValue data-testid="dm-streak">{dmSession.inARow}</StatValue>
                <StatLabel>In a Row</StatLabel>
              </Stat>
              {dmSession.state === 'finished' && (
                <div data-testid="dm-finished">
                  Death Match over! Solved: {dmSession.solved}{' '}
                  <PrimaryButton onClick={handleStartDeathMatch}>Play Again</PrimaryButton>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {currentPuzzle && (
        <Layout>
          <BoardArea>
            <ChessBoard
              position={currentPosition}
              onMove={mode === 'rush' ? handleRushMove : mode === 'deathmatch' ? handleDmMove : handleMove}
              orientation={userColor}
              disabled={session.state !== 'playing'}
              lastMove={lastBoardMove}
            />
          </BoardArea>

          <SidePanel>
            {feedback === 'correct' && (
              <CorrectFeedback>✓ Correct! Keep going...</CorrectFeedback>
            )}
            {feedback === 'solved' && (
              <CorrectFeedback>✓ Puzzle solved! Well done.</CorrectFeedback>
            )}
            {feedback === 'wrong' && (
              <WrongFeedback>✗ Wrong move. Try again or see the solution.</WrongFeedback>
            )}
            {feedback === 'none' && (
              <NeutralFeedback>
                {userColor === 'white' ? 'White' : 'Black'} to move — find the best move
              </NeutralFeedback>
            )}

            <PuzzleInfo>
              <InfoRow>
                <InfoLabel>Rating</InfoLabel>
                <InfoValue>{currentPuzzle.rating}</InfoValue>
              </InfoRow>
              <InfoRow>
                <InfoLabel>Themes</InfoLabel>
                <InfoValue>{currentPuzzle.themes.join(', ') || '—'}</InfoValue>
              </InfoRow>
              {currentPuzzle.openingTags.length > 0 && (
                <InfoRow>
                  <InfoLabel>Opening</InfoLabel>
                  <InfoValue>{currentPuzzle.openingTags.join(', ')}</InfoValue>
                </InfoRow>
              )}
              <InfoRow>
                <InfoLabel>Puzzle #</InfoLabel>
                <InfoValue>{queueIndex + 1} / {puzzleQueue.length}</InfoValue>
              </InfoRow>
            </PuzzleInfo>

            <ActionButtons>
              {session.state === 'playing' && (
                <ActionButton onClick={handleShowSolution}>
                  Show Solution
                </ActionButton>
              )}
              {(session.state === 'failed' || session.showSolution) && (
                <>
                  <ActionButton onClick={handleShowSolution} disabled={!session.puzzle || session.solutionStep >= session.puzzle.moves.length}>
                    Next Move →
                  </ActionButton>
                  <ActionButton onClick={handleRetry}>
                    Retry
                  </ActionButton>
                </>
              )}
              {(session.state === 'solved' || session.state === 'failed') && (
                <PrimaryButton onClick={handleNext}>
                  Next Puzzle →
                </PrimaryButton>
              )}
            </ActionButtons>
          </SidePanel>
        </Layout>
      )}

      {!currentPuzzle && mode === 'themed' && !selectedTheme && (
        <NeutralFeedback>Select a theme to start training</NeutralFeedback>
      )}
    </Page>
  )
}
