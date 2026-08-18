import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from '../src/pages/HomePage'

describe('HomePage', () => {
  it('renders hero and all four feature cards', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Chess Advanced')).toBeInTheDocument()
    expect(screen.getByText('Play')).toBeInTheDocument()
    expect(screen.getByText('Analyze')).toBeInTheDocument()
    expect(screen.getByText('Puzzles')).toBeInTheDocument()
    expect(screen.getByText('My Weaknesses')).toBeInTheDocument()
  })

  it('renders board square piece images', () => {
    const { container } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )

    const imgs = container.querySelectorAll('img')
    expect(imgs.length).toBeGreaterThanOrEqual(2)

    // Check that piece images point to the pieces directory
    const srcs = Array.from(imgs).map((img) => img.getAttribute('src') || '')
    expect(srcs.some((s) => s.includes('wK.svg'))).toBe(true)
    expect(srcs.some((s) => s.includes('bQ.svg'))).toBe(true)
  })
})
