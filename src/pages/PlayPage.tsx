/**
 * Play page — single-player vs configurable-strength Stockfish.
 *
 * Features:
 * - Configurable difficulty (Easy/Medium/Hard/Expert)
 * - Choose side (white/black)
 * - Click + drag to move, legal-move highlights, sound, slide animation
 * - Illegal move feedback
 * - Take-back (undo player + engine move pair)
 * - Resign
 * - Move list (SAN)
 * - "Analyze this game" — pipes PGN to /analyze via router state
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { Position, writePgn } from '../chess'
import type { Color, MoveInfo, GameOutcome, GameResult } from '../chess'
import { StockfishEngine } from '../engine/StockfishEngine'
import { ChessBoard } from '../components/ChessBoard'
import { STRENGTH_LEVELS, getStrengthConfig } from './play/strength'
import { computeTakebackTarget } from './play/gameLogic'
import type { StrengthLevel } from './play/strength'

const Container = styled.div`
  display: flex;
  gap: var(--sp-8);
  flex-wrap: wrap;
  justify-content: center;
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
  max-width: 360px;
  flex: 1;
`

const Panel = styled.div`
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-4);
`

const PanelTitle = styled.h3`
  font-size: var(--fs-sm);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--sp-3);
`

const Select = styled.select`
  width: 100%;
  padding: var(--sp-2) var(--sp-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text);
  font-size: var(--fs-base);
  cursor: pointer;

  &:focus {
    outline: 2px solid var(--accent);
  }
`

const ButtonRow = styled.div`
  display: flex;
  gap: var(--sp-2);
  flex-wrap: wrap;
`

const Button = styled.button<{ $variant?: 'primary' | 'default' | 'danger' }>`
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border);
  background: ${(p) => {
    if (p.$variant === 'primary') return 'var(--accent)'
    if (p.$variant === 'danger') return 'var(--danger)'
    return 'var(--bg-elevated)'
  }};
  color: ${(p) => (p.$variant ? '#fff' : 'var(--text)')};
  transition: all 0.15s ease;

  &:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`

const MoveList = styled.div`
  max-height: 300px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: var(--fs-sm);
  line-height: 1.8;
`

const MoveEntry = styled.span<{ $current: boolean }>`
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: ${(p) => (p.$current ? 'var(--accent-light)' : 'transparent')};
  color: ${(p) => (p.$current ? 'var(--accent)' : 'var(--text)')};
  cursor: pointer;
`

const Status = styled.div<{ $over: boolean }>`
  text-align: center;
  font-size: var(--fs-lg);
  font-weight: ${(p) => (p.$over ? 700 : 400)};
  color: ${(p) => (p.$over ? 'var(--accent)' : 'var(--text-muted)')};
  padding: var(--sp-2);
`

const EngineErrorBanner = styled.div`
  background: #fef2f2;
  color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-sm);
  text-align: center;
`

const Toast = styled.div<{ $show: boolean }>`
  position: fixed;
  bottom: var(--sp-8);
  left: 50%;
  transform: translateX(-50%);
  background: var(--danger);
  color: #fff;
  padding: var(--sp-3) var(--sp-6);
  border-radius: var(--radius-md);
  font-size: var(--fs-sm);
  font-weight: 500;
  box-shadow: var(--shadow-lg);
  opacity: ${(p) => (p.$show ? 1 : 0)};
  pointer-events: none;
  transition: opacity 0.3s ease;
  z-index: 100;
`

const SideToggle = styled.div`
  display: flex;
  gap: var(--sp-2);
`

const SideButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: var(--sp-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  background: ${(p) => (p.$active ? 'var(--accent)' : 'var(--bg-elevated)')};
  color: ${(p) => (p.$active ? '#fff' : 'var(--text)')};
  cursor: pointer;
  font-size: var(--fs-sm);
  font-weight: 500;

  &:hover {
    opacity: 0.9;
  }
`

function outcomeText(outcome: GameOutcome): string {
  switch (outcome) {
    case 'white_win':
      return 'White wins by checkmate!'
    case 'black_win':
      return 'Black wins by checkmate!'
    case 'draw':
      return 'Draw!'
    default:
      return ''
  }
}

export function PlayPage() {
  const navigate = useNavigate()
  const [position, setPosition] = useState<Position>(() => new Position())
  const [moves, setMoves] = useState<MoveInfo[]>([])
  const [playerColor, setPlayerColor] = useState<Color>('white')
  const [strength, setStrength] = useState<StrengthLevel>('Medium')
  const [isThinking, setIsThinking] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [outcome, setOutcome] = useState<GameOutcome>('ongoing')
  const [toast, setToast] = useState('')
  const [resigned, setResigned] = useState(false)

  const engineRef = useRef<StockfishEngine | null>(null)
  const positionRef = useRef<Position>(position)
  const movesRef = useRef<MoveInfo[]>(moves)
  const playerColorRef = useRef<Color>(playerColor)
  const strengthRef = useRef<StrengthLevel>(strength)
  const gameOverRef = useRef(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep refs in sync
  positionRef.current = position
  movesRef.current = moves
  playerColorRef.current = playerColor
  strengthRef.current = strength
  const [engineError, setEngineError] = useState(false)
  gameOverRef.current = gameOver

  // Init engine on mount
  useEffect(() => {
    const engine = new StockfishEngine()
    engineRef.current = engine
    engine.init().catch(() => {
      // Engine failed to init — surface to the user so they know why the engine won't reply.
      setEngineError(true)
    })
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  // Apply strength setting
  useEffect(() => {
    if (engineRef.current) {
      const cfg = getStrengthConfig(strength)
      engineRef.current.setSkillLevel(cfg.skillLevel)
    }
  }, [strength])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2500)
  }, [])

  const checkGameOver = useCallback((pos: Position): GameOutcome => {
    if (pos.isCheckmate()) {
      return pos.turn() === 'white' ? 'black_win' : 'white_win'
    }
    if (pos.isStalemate() || pos.isDraw()) {
      return 'draw'
    }
    return 'ongoing'
  }, [])

  const doEngineMove = useCallback(async () => {
    if (gameOverRef.current) return
    const engine = engineRef.current
    if (!engine) return

    const pos = positionRef.current
    if (pos.turn() === playerColorRef.current) return // it's player's turn

    setIsThinking(true)
    try {
      const cfg = getStrengthConfig(strengthRef.current)
      const result = await engine.getBestMove(pos.fen(), cfg.depth)
      if (result.bestMove && result.bestMove !== '(none)') {
        const newPos = pos.clone()
        const moveInfo = newPos.move(result.bestMove)
        setMoves((prev) => [...prev, moveInfo])
        setPosition(newPos)

        const oc = checkGameOver(newPos)
        if (oc !== 'ongoing') {
          setGameOver(true)
          setOutcome(oc)
        }
      }
    } catch {
      // Engine error — ignore
    } finally {
      setIsThinking(false)
    }
  }, [checkGameOver])

  // When it's engine's turn, make engine move
  useEffect(() => {
    if (!gameOver && position.turn() !== playerColor && !isThinking) {
      doEngineMove()
    }
  }, [position, playerColor, gameOver, isThinking, doEngineMove])

  const handleMove = useCallback(
    (uci: string): boolean => {
      if (gameOver || isThinking) return false
      const pos = positionRef.current
      if (pos.turn() !== playerColorRef.current) return false

      const legalUcis = pos.uciMoves()
      if (!legalUcis.includes(uci)) {
        showToast('Illegal move')
        return false
      }

      const newPos = pos.clone()
      const moveInfo = newPos.move(uci)
      setMoves((prev) => [...prev, moveInfo])
      setPosition(newPos)

      const oc = checkGameOver(newPos)
      if (oc !== 'ongoing') {
        setGameOver(true)
        setOutcome(oc)
      }
      return true
    },
    [gameOver, isThinking, checkGameOver, showToast],
  )

  const handleNewGame = useCallback(() => {
    const newPos = new Position()
    setPosition(newPos)
    setMoves([])
    setGameOver(false)
    setOutcome('ongoing')
    setResigned(false)
    setIsThinking(false)
  }, [])

  const handleSideChange = useCallback((color: Color) => {
    setPlayerColor(color)
    // Reset game when switching sides
    const newPos = new Position()
    setPosition(newPos)
    setMoves([])
    setGameOver(false)
    setOutcome('ongoing')
    setResigned(false)
  }, [])

  const handleTakeback = useCallback(() => {
    const target = computeTakebackTarget(movesRef.current.length, playerColorRef.current)
    if (target < 0) return

    // Rebuild position from scratch up to target plies
    const newPos = new Position()
    const keptMoves = movesRef.current.slice(0, target)
    for (const m of keptMoves) {
      newPos.move(m.uci)
    }
    setPosition(newPos)
    setMoves(keptMoves)
    setGameOver(false)
    setOutcome('ongoing')
    setResigned(false)
  }, [])

  const handleResign = useCallback(() => {
    setResigned(true)
    setGameOver(true)
    setOutcome(playerColorRef.current === 'white' ? 'black_win' : 'white_win')
  }, [])

  const handleAnalyze = useCallback(() => {
    const result: GameResult = resigned
      ? playerColor === 'white'
        ? '0-1'
        : '1-0'
      : outcome === 'white_win'
        ? '1-0'
        : outcome === 'black_win'
          ? '0-1'
          : outcome === 'draw'
            ? '1/2-1/2'
            : '*'
    const game = {
      headers: {
        White: playerColor === 'white' ? 'Player' : 'Stockfish',
        Black: playerColor === 'white' ? 'Stockfish' : 'Player',
        Result: result,
      },
      moves: moves,
      result,
      startingFen: new Position().fen(),
    }
    const pgn = writePgn(game)
    navigate('/analyze', { state: { pgn } })
  }, [moves, playerColor, resigned, outcome, navigate])

  const lastMove =
    moves.length > 0
      ? { from: moves[moves.length - 1].from, to: moves[moves.length - 1].to }
      : null

  const statusText = resigned
    ? `You resigned. ${playerColor === 'white' ? 'Black' : 'White'} wins.`
    : gameOver
      ? outcomeText(outcome)
      : isThinking
        ? 'Stockfish is thinking...'
        : position.turn() === playerColor
          ? 'Your move'
          : 'Stockfish to move'

  // Build SAN move list
  const sanList = useMemo(() => {
    const list: string[] = []
    const tempPos = new Position()
    for (const m of moves) {
      try {
        const info = tempPos.move(m.uci)
        list.push(info.san)
      } catch {
        list.push(m.san)
      }
    }
    return list
  }, [moves])

  return (
    <Container>
      <BoardArea>
        {engineError && (
          <EngineErrorBanner data-testid="engine-error" role="alert">
            Engine failed to load — you can still view the board, but the computer won't reply.
          </EngineErrorBanner>
        )}
        <Status $over={gameOver} data-testid="play-status">
          {statusText}
        </Status>
        <ChessBoard
          position={position}
          orientation={playerColor}
          onMove={handleMove}
          onIllegal={() => showToast('Illegal move')}
          lastMove={lastMove}
          showCheck={position.inCheck()}
          disabled={gameOver || isThinking || position.turn() !== playerColor}
        />
      </BoardArea>

      <SidePanel>
        <Panel>
          <PanelTitle>Difficulty</PanelTitle>
          <Select
            value={strength}
            onChange={(e) => setStrength(e.target.value as StrengthLevel)}
            disabled={isThinking}
            data-testid="strength-select"
          >
            {STRENGTH_LEVELS.map((l) => (
              <option key={l.label} value={l.label}>
                {l.label}
              </option>
            ))}
          </Select>
        </Panel>

        <Panel>
          <PanelTitle>Play as</PanelTitle>
          <SideToggle>
            <SideButton
              $active={playerColor === 'white'}
              onClick={() => handleSideChange('white')}
              data-testid="side-white"
            >
              ♔ White
            </SideButton>
            <SideButton
              $active={playerColor === 'black'}
              onClick={() => handleSideChange('black')}
              data-testid="side-black"
            >
              ♚ Black
            </SideButton>
          </SideToggle>
        </Panel>

        <Panel>
          <PanelTitle>Controls</PanelTitle>
          <ButtonRow>
            <Button $variant="primary" onClick={handleNewGame} data-testid="new-game-btn">
              New Game
            </Button>
            <Button
              onClick={handleTakeback}
              disabled={moves.length === 0 || isThinking || gameOver}
              data-testid="takeback-btn"
            >
              ↩ Take Back
            </Button>
            <Button
              $variant="danger"
              onClick={handleResign}
              disabled={gameOver}
              data-testid="resign-btn"
            >
              Resign
            </Button>
          </ButtonRow>
        </Panel>

        <Panel>
          <PanelTitle>Move List</PanelTitle>
          <MoveList data-testid="move-list">
            {sanList.length === 0 ? (
              <span style={{ color: 'var(--text-dim)' }}>No moves yet</span>
            ) : (
              sanList.map((san, i) => {
                const moveNum = Math.floor(i / 2) + 1
                const isWhite = i % 2 === 0
                return (
                  <span key={i}>
                    {isWhite && <strong style={{ color: 'var(--text-dim)' }}>{moveNum}. </strong>}
                    <MoveEntry $current={i === sanList.length - 1}>{san} </MoveEntry>
                  </span>
                )
              })
            )}
          </MoveList>
        </Panel>

        <Button
          $variant="primary"
          onClick={handleAnalyze}
          disabled={moves.length === 0}
          data-testid="analyze-btn"
          style={{ width: '100%' }}
        >
          📊 Analyze this game
        </Button>
      </SidePanel>

      <Toast $show={toast !== ''}>{toast}</Toast>
    </Container>
  )
}
