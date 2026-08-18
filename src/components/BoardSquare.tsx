import styled from 'styled-components'

const SquareWrapper = styled.div<{ $color: 'light' | 'dark' }>`
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(props) =>
    props.$color === 'light' ? 'var(--board-light)' : 'var(--board-dark)'};
  border-radius: 2px;
`

const PieceImg = styled.img`
  width: 56px;
  height: 56px;
  user-select: none;
  pointer-events: none;
`

export type PieceCode =
  | 'wK' | 'wQ' | 'wR' | 'wB' | 'wN' | 'wP'
  | 'bK' | 'bQ' | 'bR' | 'bB' | 'bN' | 'bP'

export interface BoardSquareProps {
  color: 'light' | 'dark'
  piece?: PieceCode
}

const pieceFiles: Record<PieceCode, string> = {
  wK: 'wK.svg',
  wQ: 'wQ.svg',
  wR: 'wR.svg',
  wB: 'wB.svg',
  wN: 'wN.svg',
  wP: 'wP.svg',
  bK: 'bK.svg',
  bQ: 'bQ.svg',
  bR: 'bR.svg',
  bB: 'bB.svg',
  bN: 'bN.svg',
  bP: 'bP.svg',
}

export function BoardSquare({ color, piece }: BoardSquareProps) {
  return (
    <SquareWrapper $color={color}>
      {piece && (
        <PieceImg
          src={`${import.meta.env.BASE_URL}pieces/${pieceFiles[piece]}`}
          alt={piece}
          draggable={false}
        />
      )}
    </SquareWrapper>
  )
}
