/**
 * Strength level configuration for the Play page.
 *
 * Maps Easy/Medium/Hard/Expert to Stockfish skill level + search depth.
 */

export interface StrengthConfig {
  label: 'Easy' | 'Medium' | 'Hard' | 'Expert'
  skillLevel: number
  depth: number
}

export type StrengthLevel = StrengthConfig['label']

export const STRENGTH_LEVELS: StrengthConfig[] = [
  { label: 'Easy', skillLevel: 0, depth: 1 },
  { label: 'Medium', skillLevel: 5, depth: 8 },
  { label: 'Hard', skillLevel: 10, depth: 12 },
  { label: 'Expert', skillLevel: 20, depth: 18 },
]

export function getStrengthConfig(label: StrengthLevel): StrengthConfig {
  const cfg = STRENGTH_LEVELS.find((l) => l.label === label)
  if (!cfg) throw new Error(`Unknown strength level: ${label}`)
  return cfg
}
