import { describe, it, expect } from 'vitest'
import {
  STRENGTH_LEVELS,
  getStrengthConfig,
  type StrengthLevel,
} from '../src/pages/play/strength'
import { computeTakebackTarget } from '../src/pages/play/gameLogic'

describe('strength mapping', () => {
  it('has 4 levels: Easy, Medium, Hard, Expert', () => {
    expect(STRENGTH_LEVELS).toHaveLength(4)
    expect(STRENGTH_LEVELS.map((l) => l.label)).toEqual([
      'Easy',
      'Medium',
      'Hard',
      'Expert',
    ])
  })

  it('maps Easy to low skill and shallow depth', () => {
    const cfg = getStrengthConfig('Easy')
    expect(cfg.skillLevel).toBeLessThanOrEqual(3)
    expect(cfg.depth).toBeLessThanOrEqual(3)
  })

  it('maps Expert to high skill and deep search', () => {
    const cfg = getStrengthConfig('Expert')
    expect(cfg.skillLevel).toBeGreaterThanOrEqual(18)
    expect(cfg.depth).toBeGreaterThanOrEqual(15)
  })

  it('levels are monotonically increasing in skill', () => {
    const skills = STRENGTH_LEVELS.map((l) => l.skillLevel)
    for (let i = 1; i < skills.length; i++) {
      expect(skills[i]).toBeGreaterThan(skills[i - 1])
    }
  })

  it('levels are monotonically increasing in depth', () => {
    const depths = STRENGTH_LEVELS.map((l) => l.depth)
    for (let i = 1; i < depths.length; i++) {
      expect(depths[i]).toBeGreaterThan(depths[i - 1])
    }
  })

  it('returns a valid config for each label', () => {
    const labels: StrengthLevel['label'][] = ['Easy', 'Medium', 'Hard', 'Expert']
    for (const label of labels) {
      const cfg = getStrengthConfig(label)
      expect(cfg.skillLevel).toBeGreaterThanOrEqual(0)
      expect(cfg.skillLevel).toBeLessThanOrEqual(20)
      expect(cfg.depth).toBeGreaterThanOrEqual(1)
      expect(cfg.depth).toBeLessThanOrEqual(30)
    }
  })
})

describe('computeTakebackTarget', () => {
  it('returns -1 when no moves have been played', () => {
    expect(computeTakebackTarget(0, 'white')).toBe(-1)
  })

  it('returns 0 after one move when player is white (undo just player move, no engine move before)', () => {
    // player is white. 1 ply: white(player). No engine move before it.
    // Undo just the player's move = 0 plies.
    expect(computeTakebackTarget(1, 'white')).toBe(0)
  })

  it('returns 0 after engine replies when player is white', () => {
    // After white(player) + black(engine) = 2 plies. Last was engine.
    // Undo both = 0 plies (player's turn again).
    expect(computeTakebackTarget(2, 'white')).toBe(0)
  })

  it('returns 1 after 3 plies when player is white', () => {
    // 3 plies: white(player), black(engine), white(player). Last was player.
    // Undo player's move + engine's preceding reply = 1 ply.
    expect(computeTakebackTarget(3, 'white')).toBe(1)
  })

  it('returns 0 after 2 plies when player is black', () => {
    // player is black, engine is white. 2 plies: white(engine), black(player). Last was player.
    // Undo player's move + engine's preceding move = 0 plies.
    expect(computeTakebackTarget(2, 'black')).toBe(0)
  })

  it('returns 2 after 4 plies when player is black', () => {
    // 4 plies: w(engine), b(player), w(engine), b(player). Last was player.
    // Undo player's move + engine's preceding reply = 2 plies.
    expect(computeTakebackTarget(4, 'black')).toBe(2)
  })

  it('returns -1 when player is black and only 1 ply (engine moved, player has not)', () => {
    // 1 ply: white(engine). Last was engine, not player.
    // Undo engine's reply + ... wait, lastWasPlayer is false, so undo = currentPly - 2 = -1
    expect(computeTakebackTarget(1, 'black')).toBe(-1)
  })
})
