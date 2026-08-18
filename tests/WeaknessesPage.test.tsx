import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { WeaknessesPage } from '../src/pages/WeaknessesPage'

vi.mock('../src/chess/chessCom', () => ({
  fetchChessComGames: vi.fn(),
}))

vi.mock('../src/engine/StockfishEngine', () => ({
  StockfishEngine: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    getEvaluation: vi.fn().mockResolvedValue({ bestMove: 'e2e4', score: 30, depth: 6 }),
    destroy: vi.fn(),
  })),
}))

import { fetchChessComGames } from '../src/chess/chessCom'

const mockFetchChessComGames = vi.mocked(fetchChessComGames)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WeaknessesPage', () => {
  it('renders the title and input form', () => {
    render(
      <MemoryRouter>
        <WeaknessesPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('My Weaknesses')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. hikaru')).toBeInTheDocument()
    expect(screen.getByText('Analyze')).toBeInTheDocument()
  })

  it('shows error when no username entered', async () => {
    render(
      <MemoryRouter>
        <WeaknessesPage />
      </MemoryRouter>,
    )

    const button = screen.getByText('Analyze')
    await act(async () => {
      fireEvent.click(button)
    })

    expect(screen.getByText('Please enter a chess.com username')).toBeInTheDocument()
  })

  it('shows error when no games found', async () => {
    mockFetchChessComGames.mockResolvedValueOnce([])

    render(
      <MemoryRouter>
        <WeaknessesPage />
      </MemoryRouter>,
    )

    const input = screen.getByPlaceholderText('e.g. hikaru')
    fireEvent.change(input, { target: { value: 'testuser' } })

    const button = screen.getByText('Analyze')
    await act(async () => {
      fireEvent.click(button)
    })

    await waitFor(() => {
      expect(screen.getByText('No games found for this username')).toBeInTheDocument()
    })
  })

  it('has a game count selector with 20/50/100 options', () => {
    render(
      <MemoryRouter>
        <WeaknessesPage />
      </MemoryRouter>,
    )

    const select = screen.getByLabelText('Games to Analyze')
    expect(select).toBeInTheDocument()

    const options = select.querySelectorAll('option')
    expect(options).toHaveLength(3)
    expect(options[0].value).toBe('20')
    expect(options[1].value).toBe('50')
    expect(options[2].value).toBe('100')
  })

  it('disables the analyze button and input while analyzing', async () => {
    mockFetchChessComGames.mockReturnValueOnce(new Promise(() => {}))

    render(
      <MemoryRouter>
        <WeaknessesPage />
      </MemoryRouter>,
    )

    const input = screen.getByPlaceholderText('e.g. hikaru')
    fireEvent.change(input, { target: { value: 'testuser' } })

    const button = screen.getByText('Analyze')
    await act(async () => {
      fireEvent.click(button)
    })

    await waitFor(() => {
      expect(button).toBeDisabled()
      expect(input).toBeDisabled()
    })
  })
})
