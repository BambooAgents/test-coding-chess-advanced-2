import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { BoardSquare } from '../components/BoardSquare'

const Hero = styled.div`
  text-align: center;
  margin-bottom: var(--sp-12);
`

const HeroTitle = styled.h1`
  font-size: var(--fs-4xl);
  font-weight: 700;
  letter-spacing: -0.05em;
  margin-bottom: var(--sp-4);
`

const HeroSubtitle = styled.p`
  font-size: var(--fs-lg);
  color: var(--text-muted);
`

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: var(--sp-6);
  max-width: 900px;
  margin: 0 auto;
`

const Card = styled(Link)`
  display: block;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-8);
  text-decoration: none;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }
`

const CardIcon = styled.div`
  font-size: var(--fs-3xl);
  margin-bottom: var(--sp-4);
`

const CardTitle = styled.h2`
  font-size: var(--fs-xl);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--sp-2);
`

const CardDesc = styled.p`
  font-size: var(--fs-sm);
  color: var(--text-muted);
  line-height: 1.6;
`

const PieceDemo = styled.div`
  display: flex;
  justify-content: center;
  margin-top: var(--sp-12);
  gap: var(--sp-1);
`

const cards = [
  {
    icon: '♟',
    title: 'Play',
    desc: 'Play against Stockfish at adjustable difficulty. Take back moves and analyze your game after.',
    to: '/play',
  },
  {
    icon: '📊',
    title: 'Analyze',
    desc: 'Full game analysis with move classifications, eval bar, and best-move lines. Import by PGN or chess.com username.',
    to: '/analyze',
  },
  {
    icon: '🧩',
    title: 'Puzzles',
    desc: 'Train with themed puzzles — openings, endgames, tactics. Rush mode and death-match for fun.',
    to: '/puzzles',
  },
  {
    icon: '🔍',
    title: 'My Weaknesses',
    desc: 'Enter your chess.com username and get a live analysis of your weak spots — openings, endgames, and what to train.',
    to: '/weaknesses',
  },
]

export function HomePage() {
  return (
    <div>
      <Hero>
        <HeroTitle>Chess Advanced</HeroTitle>
        <HeroSubtitle>Analyze, train, and improve your chess — all in your browser.</HeroSubtitle>
      </Hero>
      <CardGrid>
        {cards.map((card) => (
          <Card key={card.to} to={card.to}>
            <CardIcon>{card.icon}</CardIcon>
            <CardTitle>{card.title}</CardTitle>
            <CardDesc>{card.desc}</CardDesc>
          </Card>
        ))}
      </CardGrid>
      <PieceDemo>
        <BoardSquare color="light" />
        <BoardSquare color="dark" piece="wK" />
        <BoardSquare color="light" piece="bQ" />
        <BoardSquare color="dark" />
      </PieceDemo>
    </div>
  )
}
