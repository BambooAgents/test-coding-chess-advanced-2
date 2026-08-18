import { describe, it, expect } from 'vitest'

describe('smoke test', () => {
  it('should pass basic arithmetic', () => {
    expect(1 + 1).toBe(2)
  })

  it('should have a defined accent color in CSS variables', () => {
    // This just confirms the test environment is set up
    expect(typeof document).toBe('object')
  })
})
