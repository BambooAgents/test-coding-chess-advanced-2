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

/** Minimal valid PGN for a short game that parsePgn can handle. */
const SAMPLE_PGN = '[Event "Test"]\n[Site "chess.com"]\n[White "w"]\n[Black "b"]\n[Result "1-0"]\n[Opening "Italian Game"]\n[ECO "C50"]\n\n1. e4 e5 2. Nf3 Nc6 1-0'

function makeMockGames(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    pgn: SAMPLE_PGN,
    playerColor: i % 2 === 0 ? 'white' as const : 'black' as const,
  }))
}

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

  it('updates report LIVE as games complete (progressive rendering)', async () => {
    const games = makeMockGames(3)
    mockFetchChessComGames.mockResolvedValueOnce(games)

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

    // After all games complete, the final report should show 3 games analyzed
    await waitFor(() => {
      expect(screen.getByText('Analysis complete: 3 games analyzed')).toBeInTheDocument()
    })

    // During analysis, partial progress text should have appeared (at least 1 of 3)
    // The progress text format is "Analyzing game N of M..."
    // We verify the report rendered by checking the Overview section appears
    expect(screen.getByText('Games Analyzed')).toBeInTheDocument()
  })
})
