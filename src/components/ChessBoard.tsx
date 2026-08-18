/**
 * Interactive chess board component.
 *
 * Renders a FEN position with click-to-move and drag-and-drop interaction.
 * Highlights legal moves on piece selection. Supports both player perspectives.
 *
 * Uses the chess core Position API for legal-move generation and validation.
 */

import { useState, useRef, useCallback, useMemo } from 'react'
import styled from 'styled-components'
import { Position } from '../chess/Position'
import type { PieceCode } from './BoardSquare'


const BoardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  grid-template-rows: repeat(8, 1fr);
  width: min(100%, 480px);
  aspect-ratio: 1;
  border: 3px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
  user-select: none;
  touch-action: none;
`

const Square = styled.div<{ $isLight: boolean; $isSelected: boolean; $isLegal: boolean; $isLastMove: boolean; $isCheck: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) => {
    if (props.isCheck) return '#dc2626'
    if (props.isLight) return 'var(--board-light)'
    return 'var(--board-dark)'
  }};
  cursor: ${(props) => (props.$isLegal ? 'pointer' : 'default')};
  position: relative;
  transition: background 0.1s ease;

  ${(props) => props.$isSelected && `box-shadow: inset 0 0 0 3px var(--accent);`}

  &::after {
    content: '';
    position: absolute;
    width: 30%;
    height: 30%;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.25);
    ${(props) => (props.$isLegal ? '' : 'display: none;')}
  }
`

const PieceImg = styled.img`
  width: 85%;
  height: 85%;
  object-fit: contain;
  pointer-events: none;
  ${(props) => (props.className?.includes('draggable') ? 'cursor: grab;' : '')}
`

const pieceMap: Record<string, PieceCode> = {
  'wp': 'wP', 'wn': 'wN', 'wb': 'wB', 'wr': 'wR', 'wq': 'wQ', 'wk': 'wK',
  'bp': 'bP', 'bn': 'bN', 'bb': 'bB', 'br': 'bR', 'bq': 'bQ', 'bk': 'bK',
}

const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

function squareName(file: number, rank: number): string {
  return fileNames[file] + (rank + 1)
}

export interface ChessBoardProps {
  /** FEN of the position to render. */
  fen: string
  /** Called when the user attempts a move (from-to in UCI). */
  onMove: (uci: string) => void
  /** Which side is at the bottom. Default: white. */
  orientation?: 'white' | 'black'
  /** Whether interaction is enabled. */
  interactive?: boolean
  /** Last move played (from-to squares for highlight). */
  lastMove?: { from: string; to: string } | null
}

export function ChessBoard({
  fen,
  onMove,
  orientation = 'white',
  interactive = true,
  lastMove = null,
}: ChessBoardProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const dragSquare = useRef<string | null>(null)

  const position = useMemo(() => new Position(fen), [fen])
  const board = useMemo(() => position.board(), [position])

  const turn = position.turn()
  const inCheck = position.inCheck()

  // Find the king square if in check
  const checkSquare = useMemo(() => {
    if (!inCheck) return null
    for (const [sq, piece] of board) {
      if (piece.type === 'k' && piece.color === (turn === 'white' ? 'w' : 'b')) {
        return sq
      }
    }
    return null
  }, [board, inCheck, turn])

  const handleSquareClick = useCallback((sq: string) => {
    if (!interactive) return

    const piece = board.get(sq)
    const pieceColor = piece ? (piece.color === 'w' ? 'white' : 'black') : null

    if (selected === sq) {
      // Deselect
      setSelected(null)
      setLegalMoves([])
      return
    }

    if (selected && legalMoves.includes(sq)) {
      // Make the move
      onMove(selected + sq)
      setSelected(null)
      setLegalMoves([])
      return
    }

    if (piece && pieceColor === turn) {
      // Select this piece and compute legal moves
      const pos = new Position(fen)
      const allMoves = pos.moves()
      const dests = allMoves
        .filter((m) => m.from === sq)
        .map((m) => m.to)
      setSelected(sq)
      setLegalMoves(dests)
    } else {
      setSelected(null)
      setLegalMoves([])
    }
  }, [interactive, board, selected, legalMoves, turn, fen, onMove])

  const handleDragStart = useCallback((sq: string) => {
    if (!interactive) return
    const piece = board.get(sq)
    const pieceColor = piece ? (piece.color === 'w' ? 'white' : 'black') : null
    if (piece && pieceColor === turn) {
      const pos = new Position(fen)
      const allMoves = pos.moves()
      const dests = allMoves
        .filter((m) => m.from === sq)
        .map((m) => m.to)
      setSelected(sq)
      setLegalMoves(dests)
      dragSquare.current = sq
    }
  }, [interactive, board, turn, fen])

  const handleDrop = useCallback((sq: string) => {
    if (!interactive || !dragSquare.current) return
    if (legalMoves.includes(sq)) {
      onMove(dragSquare.current + sq)
    }
    setSelected(null)
    setLegalMoves([])
    dragSquare.current = null
  }, [interactive, legalMoves, onMove])

  // Render squares in display order (depends on orientation)
  const rows = orientation === 'white' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]
  const cols = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0]

  return (
    <BoardGrid>
      {rows.map((rank) =>
        cols.map((file) => {
          const sq = squareName(file, rank)
          const piece = board.get(sq)
          const isLight = (file + rank) % 2 === 1
          const isSelected = selected === sq
          const isLegal = legalMoves.includes(sq)
          const isLastMove = lastMove && (lastMove.from === sq || lastMove.to === sq)
          const isCheck = checkSquare === sq

          const pieceKey = piece ? piece.color + piece.type : null
          const pieceCode = pieceKey ? pieceMap[pieceKey] : undefined

          return (
            <Square
              key={sq}
              $isLight={isLight}
              $isSelected={isSelected}
              $isLegal={isLegal}
              $isLastMove={!!isLastMove}
              $isCheck={isCheck}
              onClick={() => handleSquareClick(sq)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleDrop(sq) }}
            >
              {pieceCode && (
                <PieceImg
                  src={`${import.meta.env.BASE_URL}pieces/${pieceCode}.svg`}
                  alt={pieceCode}
                  draggable={interactive}
                  onDragStart={() => handleDragStart(sq)}
                  className={interactive ? 'draggable' : ''}
                />
              )}
            </Square>
          )
        })
      )}
    </BoardGrid>
  )
}
