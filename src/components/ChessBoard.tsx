/**
 * ChessBoard — interactive board component with click-to-move and drag-to-move.
 *
 * Features:
 * - Click to select a piece, click destination to move
 * - Drag and drop pieces
 * - Highlights legal moves on selection
 * - Sound effect on move
 * - Slide animation on move
 * - Illegal move feedback via callback
 *
 * Uses Lichess CBurnett pieces from public/pieces/.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import styled from 'styled-components'
import type { Color, Square } from '../chess'
import { Position } from '../chess'
import type { PieceCode } from './BoardSquare'

const BoardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: min(560px, 90vw);
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  user-select: none;
  touch-action: none;
`

const Sq = styled.div<{
  $isLight: boolean
  $isSelected: boolean
  $isLegal: boolean
  $isLastMove: boolean
  $isCheck: boolean
  $dragOver: boolean
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  background: ${(p) => {
    if (p.$isCheck) return '#dc2626'
    if (p.$isSelected) return 'var(--accent-soft)'
    if (p.$isLastMove) return '#fbbf2444'
    return p.$isLight ? 'var(--board-light)' : 'var(--board-dark)'
  }};
  ${(p) =>
    p.$dragOver &&
    `
    box-shadow: inset 0 0 0 3px var(--accent);
  `}

  &::after {
    content: '';
    position: absolute;
    width: 30%;
    height: 30%;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.25);
    opacity: ${(p) => (p.$isLegal ? 0.4 : 0)};
    pointer-events: none;
  }
`

const PieceImg = styled.img<{ $animate: boolean }>`
  width: 87%;
  height: 87%;
  user-select: none;
  pointer-events: none;
  transition: ${(p) => (p.$animate ? 'transform 0.15s ease-out' : 'none')};
`

const pieceFiles: Record<PieceCode, string> = {
  wK: 'wK.svg', wQ: 'wQ.svg', wR: 'wR.svg', wB: 'wB.svg', wN: 'wN.svg', wP: 'wP.svg',
  bK: 'bK.svg', bQ: 'bQ.svg', bR: 'bR.svg', bB: 'bB.svg', bN: 'bN.svg', bP: 'bP.svg',
}

function coordsToSquare(file: number, rank: number): string {
  return 'abcdefgh'[file] + (8 - rank)
}

function isLight(file: number, rank: number): boolean {
  return (file + rank) % 2 === 0
}

function pieceCode(piece: { type: string; color: 'w' | 'b' }): PieceCode {
  return `${piece.color}${piece.type.toUpperCase()}` as PieceCode
}

// Simple move sound using Web Audio API
let audioCtx: AudioContext | null = null
function playMoveSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.frequency.value = 400
    osc.type = 'sine'
    gain.gain.value = 0.15
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.15)
  } catch {
    // Audio not available
  }
}

function playIllegalSound() {
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.frequency.value = 200
    osc.type = 'square'
    gain.gain.value = 0.1
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.2)
  } catch {
    // Audio not available
  }
}

export interface ChessBoardProps {
  position: Position
  orientation?: Color
  /** Called when the user attempts a move (UCI string). Return true if accepted. */
  onMove: (uci: string) => boolean
  /** Squares that are part of the last move (from, to) for highlight */
  lastMove?: { from: Square; to: Square } | null
  /** Whether the side to move is in check (highlight king) */
  showCheck?: boolean
  /** Disable interaction */
  disabled?: boolean
}

export function ChessBoard({
  position,
  orientation = 'white',
  onMove,
  lastMove = null,
  showCheck = false,
  disabled = false,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<Square | null>(null)
  const [legalTargets, setLegalTargets] = useState<Set<string>>(new Set())
  const [dragSq, setDragSq] = useState<Square | null>(null)
  const [animate, setAnimate] = useState(false)
  const dragData = useRef<{ from: Square } | null>(null)

  // Reset selection when position changes
  const fen = position.fen()
  useEffect(() => {
    setSelected(null)
    setLegalTargets(new Set())
    setAnimate(true)
    const t = setTimeout(() => setAnimate(false), 200)
    return () => clearTimeout(t)
  }, [fen])

  const board = position.board()
  const turn = position.turn()

  // Find king square for check highlight
  let checkSq: string | null = null
  if (showCheck && position.inCheck()) {
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = coordsToSquare(f, r)
        const p = board.get(sq)
        if (p && p.type === 'k' && p.color === (turn === 'white' ? 'w' : 'b')) {
          checkSq = sq
        }
      }
    }
  }

  const handleSquareClick = useCallback(
    (sq: string) => {
      if (disabled) return

      const piece = board.get(sq)

      if (selected) {
        if (sq === selected) {
          setSelected(null)
          setLegalTargets(new Set())
          return
        }

        if (legalTargets.has(sq)) {
          const from = selected
          // Determine promotion
          const p = board.get(from)
          let uci = `${from}${sq}`
          if (p && p.type === 'p') {
            const toRank = parseInt(sq[1], 10)
            if ((p.color === 'w' && toRank === 8) || (p.color === 'b' && toRank === 1)) {
              uci += 'q' // auto-queen for simplicity
            }
          }
          const accepted = onMove(uci)
          if (accepted) playMoveSound()
          else playIllegalSound()
          setSelected(null)
          setLegalTargets(new Set())
          return
        }

        // Selecting a new piece
        if (piece && piece.color === (turn === 'white' ? 'w' : 'b')) {
          setSelected(sq)
          const moves = position.moves().filter((m) => m.from === sq)
          setLegalTargets(new Set(moves.map((m) => m.to)))
        } else {
          setSelected(null)
          setLegalTargets(new Set())
        }
      } else {
        // Selecting a piece
        if (piece && piece.color === (turn === 'white' ? 'w' : 'b')) {
          setSelected(sq)
          const moves = position.moves().filter((m) => m.from === sq)
          setLegalTargets(new Set(moves.map((m) => m.to)))
        }
      }
    },
    [selected, legalTargets, board, turn, position, onMove, disabled],
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, sq: string) => {
      if (disabled) return
      const piece = board.get(sq)
      if (!piece || piece.color !== (turn === 'white' ? 'w' : 'b')) {
        e.preventDefault()
        return
      }
      dragData.current = { from: sq }
      setSelected(sq)
      const moves = position.moves().filter((m) => m.from === sq)
      setLegalTargets(new Set(moves.map((m) => m.to)))
      // Set a transparent drag image
      e.dataTransfer.effectAllowed = 'move'
      // Must set some data for Firefox
      e.dataTransfer.setData('text/plain', sq)
    },
    [board, turn, position, disabled],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent, sq: string) => {
      if (dragData.current && legalTargets.has(sq)) {
        e.preventDefault()
        setDragSq(sq)
      }
    },
    [legalTargets],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, sq: string) => {
      e.preventDefault()
      if (!dragData.current) return
      const from = dragData.current.from
      setDragSq(null)
      dragData.current = null

      if (legalTargets.has(sq)) {
        const p = board.get(from)
        let uci = `${from}${sq}`
        if (p && p.type === 'p') {
          const toRank = parseInt(sq[1], 10)
          if ((p.color === 'w' && toRank === 8) || (p.color === 'b' && toRank === 1)) {
            uci += 'q'
          }
        }
        const accepted = onMove(uci)
        if (accepted) playMoveSound()
        else playIllegalSound()
      }
      setSelected(null)
      setLegalTargets(new Set())
    },
    [legalTargets, board, onMove],
  )

  const handleDragEnd = useCallback(() => {
    setDragSq(null)
    dragData.current = null
    setSelected(null)
    setLegalTargets(new Set())
  }, [])

  // Render squares: if orientation is black, flip the board
  const rows = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]
  const cols = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]

  return (
    <BoardGrid data-testid="chess-board">
      {rows.map((r) =>
        cols.map((f) => {
          const sq = coordsToSquare(f, r)
          const piece = board.get(sq)
          const isSelected = selected === sq
          const isLegal = legalTargets.has(sq) && !piece
          const isLegalCapture = legalTargets.has(sq) && !!piece
          const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq)
          const isCheck = checkSq === sq

          return (
            <Sq
              key={sq}
              data-square={sq}
              $isLight={isLight(f, r)}
              $isSelected={isSelected}
              $isLegal={isLegal}
              $isLastMove={!!isLastMove}
              $isCheck={isCheck}
              $dragOver={dragSq === sq}
              onClick={() => handleSquareClick(sq)}
              onDragOver={(e) => handleDragOver(e, sq)}
              onDrop={(e) => handleDrop(e, sq)}
              style={isLegalCapture ? { cursor: 'pointer' } : undefined}
            >
              {piece && (
                <PieceImg
                  src={`${import.meta.env.BASE_URL}pieces/${pieceFiles[pieceCode(piece)]}`}
                  alt={pieceCode(piece)}
                  draggable={!disabled}
                  $animate={animate}
                  onDragStart={(e) => handleDragStart(e, sq)}
                  onDragEnd={handleDragEnd}
                />
              )}
            </Sq>
          )
        }),
      )}
    </BoardGrid>
  )
}
