/**
 * Chess.com game fetcher — client-side fetch using the chess.com pubapi.
 *
 * The pubapi sends `access-control-allow-origin: *` (verified), so direct
 * browser fetch works. No backend/proxy needed.
 *
 * API docs: https://www.chess.com/news/view/published-data-api
 */

export interface FetchChessComGamesOptions {
  /** Number of games to fetch (default 50). */
  count?: number
  /** Fetch starting from this many months back (default 0 = current month). */
  monthsBack?: number
}

export interface ChessComGame {
  /** The PGN text of the game. */
  pgn: string
  /** Time control of the game. */
  timeControl?: string
  /** Game URL on chess.com. */
  url?: string
  /** Whether the player is white or black. */
  playerColor?: 'white' | 'black'
}

/**
 * Fetch a chess.com player's monthly game archives (PGN).
 *
 * Uses the pubapi: GET /pub/player/{username}/games/{YYYY}/{MM}
 * Returns an array of PGN strings.
 *
 * This function is designed to be called from the browser. In tests,
 * the `fetch` global is mocked.
 */
export async function fetchChessComGames(
  username: string,
  options: FetchChessComGamesOptions = {},
): Promise<ChessComGame[]> {
  const { count = 50, monthsBack = 0 } = options

  const cleanUsername = username.trim().toLowerCase()
  if (!cleanUsername) {
    throw new Error('Username is required')
  }

  // First, get the list of available monthly archives
  const archivesUrl = `https://api.chess.com/pub/player/${cleanUsername}/games/archives`
  const archivesResponse = await fetch(archivesUrl)
  if (!archivesResponse.ok) {
    throw new Error(
      `Failed to fetch chess.com archives for "${username}": ${archivesResponse.status} ${archivesResponse.statusText}`,
    )
  }

  const archivesData = (await archivesResponse.json()) as { archives: string[] }
  const archives = archivesData.archives ?? []

  if (archives.length === 0) {
    return []
  }

  // Sort archives in reverse chronological order (most recent first)
  // and optionally skip the first `monthsBack` months
  const sortedArchives = [...archives].reverse().slice(monthsBack)

  const games: ChessComGame[] = []
  let rateLimitDelay = 0

  for (const archiveUrl of sortedArchives) {
    if (games.length >= count) break

    // Respect rate limits: chess.com pubapi allows ~300 requests/min
    // but we add a small delay between requests to be polite
    if (rateLimitDelay > 0) {
      await sleep(rateLimitDelay)
    }
    rateLimitDelay = 200 // 200ms between requests

    try {
      const response = await fetch(archiveUrl)
      if (!response.ok) {
        // Skip failed months (rate limit, server error, etc.)
        continue
      }

      const data = (await response.json()) as {
        games: Array<{
          pgn?: string
          time_control?: string
          url?: string
          white?: { username?: string }
          black?: { username?: string }
        }>
      }

      const monthGames = data.games ?? []
      for (const game of monthGames) {
        if (games.length >= count) break
        if (!game.pgn) continue

        // Determine player color
        const playerColor =
          game.white?.username?.toLowerCase() === cleanUsername
            ? ('white' as const)
            : game.black?.username?.toLowerCase() === cleanUsername
              ? ('black' as const)
              : undefined

        games.push({
          pgn: game.pgn,
          timeControl: game.time_control,
          url: game.url,
          playerColor,
        })
      }
    } catch {
      // Skip failed months
      continue
    }
  }

  return games
}

/**
 * Fetch the list of available monthly archive URLs for a player.
 */
export async function fetchChessComArchives(
  username: string,
): Promise<string[]> {
  const cleanUsername = username.trim().toLowerCase()
  const url = `https://api.chess.com/pub/player/${cleanUsername}/games/archives`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Failed to fetch chess.com archives: ${response.status}`,
    )
  }
  const data = (await response.json()) as { archives: string[] }
  return data.archives ?? []
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
