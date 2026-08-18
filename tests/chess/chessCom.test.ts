/**
 * Tests for chess.com game fetching.
 *
 * The fetch global is mocked — no network calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchChessComGames, fetchChessComArchives } from '../../src/chess/chessCom'

// Mock the global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response
}

beforeEach(() => {
  mockFetch.mockReset()
})

describe('fetchChessComArchives', () => {
  it('returns archive URLs', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        archives: [
          'https://api.chess.com/pub/player/test/games/2024/01',
          'https://api.chess.com/pub/player/test/games/2024/02',
        ],
      }),
    )

    const result = await fetchChessComArchives('testuser')
    expect(result).toHaveLength(2)
    expect(result[0]).toContain('2024/01')
  })

  it('throws on failed request', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, false, 404))
    await expect(fetchChessComArchives('baduser')).rejects.toThrow()
  })

  it('returns empty array when no archives', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ archives: [] }))
    const result = await fetchChessComArchives('newuser')
    expect(result).toEqual([])
  })
})

describe('fetchChessComGames', () => {
  it('fetches games from monthly archives', async () => {
    // First call: archives list
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        archives: [
          'https://api.chess.com/pub/player/test/games/2024/01',
          'https://api.chess.com/pub/player/test/games/2024/02',
        ],
      }),
    )

    // Second call: games from January
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        games: [
          {
            pgn: '[Event "Game 1"]\n[Result "1-0"]\n\n1. e4 e5 2. Qh5 Ke7 3. Qxe5# 1-0',
            time_control: '600',
            url: 'https://chess.com/game/1',
            white: { username: 'test' },
            black: { username: 'opponent' },
          },
        ],
      }),
    )

    // Third call: games from February
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        games: [
          {
            pgn: '[Event "Game 2"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1',
            time_control: '600',
            url: 'https://chess.com/game/2',
            white: { username: 'opponent' },
            black: { username: 'test' },
          },
        ],
      }),
    )

    const games = await fetchChessComGames('test', { count: 10 })
    expect(games).toHaveLength(2)
    expect(games[0].pgn).toContain('Game 1')
    expect(games[0].playerColor).toBe('white')
    expect(games[1].pgn).toContain('Game 2')
    expect(games[1].playerColor).toBe('black')
  })

  it('respects count limit', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        archives: ['https://api.chess.com/pub/player/test/games/2024/01'],
      }),
    )

    mockFetch.mockResolvedValueOnce(
      mockResponse({
        games: [
          { pgn: 'game1', white: { username: 'test' }, black: { username: 'opp' } },
          { pgn: 'game2', white: { username: 'test' }, black: { username: 'opp' } },
          { pgn: 'game3', white: { username: 'test' }, black: { username: 'opp' } },
        ],
      }),
    )

    const games = await fetchChessComGames('test', { count: 2 })
    expect(games).toHaveLength(2)
  })

  it('handles empty username', async () => {
    await expect(fetchChessComGames('')).rejects.toThrow('Username is required')
  })

  it('handles failed archive fetch', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}, false, 404))
    await expect(fetchChessComGames('baduser')).rejects.toThrow()
  })

  it('handles no archives', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ archives: [] }))
    const games = await fetchChessComGames('newuser')
    expect(games).toEqual([])
  })

  it('skips games without PGN', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        archives: ['https://api.chess.com/pub/player/test/games/2024/01'],
      }),
    )

    mockFetch.mockResolvedValueOnce(
      mockResponse({
        games: [
          { pgn: 'game1', white: { username: 'test' }, black: { username: 'opp' } },
          { pgn: null, white: { username: 'test' }, black: { username: 'opp' } },
          { pgn: 'game3', white: { username: 'test' }, black: { username: 'opp' } },
        ],
      }),
    )

    const games = await fetchChessComGames('test', { count: 10 })
    expect(games).toHaveLength(2) // skipped the null PGN
  })

  it('skips failed month fetches', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        archives: [
          'https://api.chess.com/pub/player/test/games/2024/01',
          'https://api.chess.com/pub/player/test/games/2024/02',
        ],
      }),
    )

    // First month fails
    mockFetch.mockResolvedValueOnce(mockResponse({}, false, 500))

    // Second month succeeds
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        games: [
          { pgn: 'game1', white: { username: 'test' }, black: { username: 'opp' } },
        ],
      }),
    )

    const games = await fetchChessComGames('test', { count: 10 })
    expect(games).toHaveLength(1) // only from the second month
  })

  it('normalizes username to lowercase', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ archives: [] }))
    await fetchChessComGames('TestUser')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.chess.com/pub/player/testuser/games/archives',
    )
  })
})
