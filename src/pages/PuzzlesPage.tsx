import styled from 'styled-components'

const Placeholder = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: var(--text-muted);
  text-align: center;
`

const Icon = styled.div`
  font-size: var(--fs-4xl);
  margin-bottom: var(--sp-4);
`

const Title = styled.h2`
  font-size: var(--fs-2xl);
  font-weight: 600;
  color: var(--text);
  margin-bottom: var(--sp-2);
`

const Desc = styled.p`
  font-size: var(--fs-base);
`

export function PuzzlesPage() {
  return (
    <Placeholder>
      <Icon>🧩</Icon>
      <Title>Puzzles</Title>
      <Desc>Themed puzzles, rush, and death-match — coming in the next ticket.</Desc>
    </Placeholder>
  )
}
