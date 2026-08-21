/**
 * EvalBar — vertical evaluation bar, White's perspective.
 * White advantage at the bottom, Black at the top.
 */
import styled from 'styled-components'
import type { EvalScore } from '../chess/types'

interface EvalBarProps {
  evalScore: EvalScore | null
}

const Bar = styled.div`
  width: 24px;
  min-height: 320px;
  height: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: #1e1e1e;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
`

const WhiteFill = styled.div<{ $pct: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${(props) => props.$pct}%;
  background: #f8f8f8;
  transition: height 0.3s ease;
`

const Label = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  font-weight: 600;
  color: #333;
  mix-blend-mode: difference;
  pointer-events: none;
`

/** Convert an eval (White's POV) to a 0-100 white-advantage percentage. */
function evalToWhitePct(score: EvalScore | null): number {
  if (!score) return 50
  let cp: number
  if (score.mate !== undefined) {
    cp = score.mate > 0 ? 1000 : -1000
  } else {
    cp = score.cp ?? 0
  }
  // Logistic squash, clamped.
  const pct = 100 / (1 + Math.exp(-cp / 400))
  return Math.max(2, Math.min(98, pct))
}

export function EvalBar({ evalScore: ev }: EvalBarProps) {
  const pct = evalToWhitePct(ev)
  const label = ev
    ? ev.mate !== undefined
      ? `M${Math.abs(ev.mate)}`
      : `${(ev.cp ?? 0) > 0 ? '+' : ''}${(ev.cp ?? 0) / 100}`
    : ''
  return (
    <Bar data-testid="eval-bar">
      <WhiteFill $pct={pct} />
      <Label style={{ top: 4 }}>{label && ev && (ev.cp ?? 0) < 0 ? label : ''}</Label>
      <Label style={{ bottom: 4 }}>{label && ev && (ev.cp ?? 0) >= 0 ? label : ''}</Label>
    </Bar>
  )
}
