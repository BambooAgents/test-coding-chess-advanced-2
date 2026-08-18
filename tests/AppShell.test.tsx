import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../src/components/AppShell'

describe('AppShell', () => {
  it('renders the nav with all route links', () => {
    render(
      <MemoryRouter>
        <AppShell />
      </MemoryRouter>,
    )

    expect(screen.getByText('♟ Chess Advanced')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Play')).toBeInTheDocument()
    expect(screen.getByText('Analyze')).toBeInTheDocument()
    expect(screen.getByText('Puzzles')).toBeInTheDocument()
    expect(screen.getByText('My Weaknesses')).toBeInTheDocument()
  })
})
