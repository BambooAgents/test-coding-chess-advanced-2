/**
 * Stockfish WebAssembly engine wrapper.
 *
 * Loads stockfish.wasm.js (from public/stockfish/) as a Web Worker,
 * communicates via the UCI protocol, and exposes a Promise-based API
 * for getting best moves.
 *
 * The stockfish.js package provides self-contained worker scripts
 * (stockfish.wasm.js for WASM support, stockfish.js for JS fallback).
 * We copy these to public/stockfish/ at build-setup time so they're
 * served as static assets — Vite doesn't need to bundle them.
 */

export interface StockfishResult {
  bestMove: string
  ponder?: string
  score?: number
  mate?: number
  depth?: number
}

/** One MultiPV line from the engine. */
export interface MultiPvLine {
  /** The principal variation as an array of UCI moves. */
  pv: string[]
  /** Centipawn score (White's POV), if a cp score was returned. */
  cp?: number
  /** Mate-in-N (White's POV, positive = White mates), if a mate score was returned. */
  mate?: number
  /** Search depth reached for this line. */
  depth?: number
}

export class StockfishEngine {
  private worker: Worker | null = null
  private listeners: Map<string, (line: string) => void> = new Map()
  private ready: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.worker) return

    this.ready = new Promise<void>((resolve, reject) => {
      try {
        // Load stockfish.wasm.js directly as a Web Worker from the
        // public/stockfish/ directory. The base path (e.g.
        // /test-coding-chess-advanced-2/) is prepended so this works
        // on GitHub Pages subpath hosting.
        const basePath = import.meta.env.BASE_URL ?? '/'
        const workerUrl = `${basePath}stockfish/stockfish.wasm.js`

        this.worker = new Worker(workerUrl, { type: 'classic' })

        this.worker.onmessage = (e: MessageEvent) => {
          const line: string = typeof e.data === 'string' ? e.data : ''
          if (line) {
            this.handleMessage(line)
          }
        }

        this.worker.onerror = (e: ErrorEvent) => {
          reject(new Error(`Stockfish worker error: ${e.message}`))
        }

        // Wait for "uciok" to know the engine is ready
        const readyHandler = (line: string) => {
          if (line === 'uciok') {
            this.removeListener('uci', readyHandler)
            resolve()
          }
        }
        this.addListener('uci', readyHandler)

        // Send uci to initialize
        this.send('uci')
      } catch (err) {
        reject(err)
      }
    })

    return this.ready
  }

  private addListener(type: string, handler: (line: string) => void): void {
    const key = `${type}-${Math.random().toString(36).slice(2)}`
    this.listeners.set(key, handler)
  }

  private removeListener(_type: string, handler: (line: string) => void): void {
    for (const [key, val] of this.listeners) {
      if (val === handler) {
        this.listeners.delete(key)
        break
      }
    }
  }

  private handleMessage(line: string): void {
    // Notify all listeners
    for (const [, handler] of this.listeners) {
      handler(line)
    }
  }

  private send(msg: string): void {
    if (!this.worker) {
      throw new Error('Stockfish worker not initialized')
    }
    this.worker.postMessage(msg)
  }

  /**
   * Get the full evaluation for a given FEN position at a given depth.
   * Includes both best move and score (cp or mate).
   *
   * On a checkmate position Stockfish 2019-08-15 outputs `info depth 0 score
   * mate 0` and then NO `bestmove` line. We resolve immediately when we see
   * `score mate 0` so the caller never hangs. A 10-second safety timeout is
   * also set as a backstop for any other edge case.
   */
  async getEvaluation(fen: string, depth = 6): Promise<StockfishResult> {
    if (!this.worker) {
      throw new Error('Stockfish not initialized. Call init() first.')
    }

    // UCI scores are from the side-to-move's perspective. Normalize to
    // White's POV by negating when Black is to move (FEN field 2 = 'b').
    const stm = fen.split(' ')[1]
    const toWhite = (v: number | undefined) =>
      v === undefined ? undefined : stm === 'b' ? -v : v

    return new Promise<StockfishResult>((resolve) => {
      let resolved = false
      let bestMove = ''
      let ponder: string | undefined
      let score: number | undefined
      let mate: number | undefined
      let searchDepth: number | undefined

      const finish = (result: StockfishResult) => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        this.removeListener('search', handler)
        resolve(result)
      }

      const handler = (line: string) => {
        if (line.startsWith('info')) {
          const depthMatch = line.match(/depth (\d+)/)
          if (depthMatch) {
            searchDepth = parseInt(depthMatch[1], 10)
          }
          // Parse both centipawn and mate scores.
          // Format: "info ... score cp <N> ..." or "info ... score mate <N> ..."
          const cpMatch = line.match(/score cp (-?\d+)/)
          if (cpMatch) {
            score = toWhite(parseInt(cpMatch[1], 10))
          }
          const mateMatch = line.match(/score mate (-?\d+)/)
          if (mateMatch) {
            mate = toWhite(parseInt(mateMatch[1], 10))
            // On a checkmate (or stalemate) position Stockfish outputs
            // `info depth 0 score mate 0` and never sends `bestmove`.
            // Resolve immediately so we don't hang forever.
            if (parseInt(mateMatch[1], 10) === 0) {
              finish({
                bestMove: '(none)',
                score: undefined,
                mate: 0,
                depth: searchDepth ?? 0,
              })
              return
            }
          }
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/)
          bestMove = parts[1] || '(none)'
          if (parts[3] && parts[3] !== '(none)') {
            ponder = parts[3]
          }
          finish({
            bestMove,
            ponder,
            score,
            mate,
            depth: searchDepth,
          })
        }
      }

      this.addListener('search', handler)

      this.send('ucinewgame')
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)

      // 10-second safety timeout: if no bestmove and no mate 0 arrives,
      // resolve with whatever we have so we never hang.
      const timer = setTimeout(() => {
        finish({
          bestMove: bestMove || '(none)',
          ponder,
          score,
          mate,
          depth: searchDepth,
        })
      }, 10_000)
    })
  }

  /**
   * Get the best move for a given FEN position at a given depth.
   *
   * On a checkmate position Stockfish does not send `bestmove` — see
   * `getEvaluation` for details. We resolve immediately on `score mate 0`
   * and add a 10-second safety timeout.
   */
  async getBestMove(fen: string, depth = 10): Promise<StockfishResult> {
    if (!this.worker) {
      throw new Error('Stockfish not initialized. Call init() first.')
    }

    // UCI scores are from the side-to-move's perspective. Normalize to White's POV.
    const stm = fen.split(' ')[1]
    const toWhite = (v: number | undefined) =>
      v === undefined ? undefined : stm === 'b' ? -v : v

    return new Promise<StockfishResult>((resolve) => {
      let resolved = false
      let bestMove = ''
      let ponder: string | undefined
      let score: number | undefined
      let mate: number | undefined
      let searchDepth: number | undefined

      const finish = (result: StockfishResult) => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        this.removeListener('search', handler)
        resolve(result)
      }

      const handler = (line: string) => {
        // Parse info lines for score/depth
        if (line.startsWith('info')) {
          const depthMatch = line.match(/depth (\d+)/)
          if (depthMatch) {
            searchDepth = parseInt(depthMatch[1], 10)
          }
          const cpMatch = line.match(/score cp (-?\d+)/)
          if (cpMatch) {
            score = toWhite(parseInt(cpMatch[1], 10))
          }
          const mateMatch = line.match(/score mate (-?\d+)/)
          if (mateMatch) {
            mate = toWhite(parseInt(mateMatch[1], 10))
            // Checkmate/stalemate: no bestmove will follow.
            if (parseInt(mateMatch[1], 10) === 0) {
              finish({
                bestMove: '(none)',
                score: undefined,
                mate: 0,
                depth: searchDepth ?? 0,
              })
              return
            }
          }
        }

        // Parse bestmove
        if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/)
          bestMove = parts[1] || '(none)'
          if (parts[3] && parts[3] !== '(none)') {
            ponder = parts[3]
          }
          finish({
            bestMove,
            ponder,
            score,
            mate,
            depth: searchDepth,
          })
        }
      }

      this.addListener('search', handler)

      this.send('ucinewgame')
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)

      const timer = setTimeout(() => {
        finish({
          bestMove: bestMove || '(none)',
          ponder,
          score,
          mate,
          depth: searchDepth,
        })
      }, 10_000)
    })
  }

  /**
   * Get N principal variations for a FEN at a given depth.
   *
   * Sends `setoption name MultiPV value N` before the search, parses
   * `info depth X multipv 1/2 ... pv e2e4 e7e5 ... score cp N` (or `score mate N`)
   * lines, and resets MultiPV to 1 afterward.
   *
   * Returns an array of MultiPvLine, one per PV (length = n).
   */
  async getMultiPv(fen: string, depth = 12, n = 2): Promise<MultiPvLine[]> {
    if (!this.worker) {
      throw new Error('Stockfish not initialized. Call init() first.')
    }

    // UCI scores are from the side-to-move's perspective. Normalize to White's POV.
    const stm = fen.split(' ')[1]
    const toWhite = (v: number | undefined) =>
      v === undefined ? undefined : stm === 'b' ? -v : v

    return new Promise<MultiPvLine[]>((resolve) => {
      let resolved = false
      const lines: Map<number, MultiPvLine> = new Map()
      let searchDepth: number | undefined

      const finish = (result: MultiPvLine[]) => {
        if (resolved) return
        resolved = true
        clearTimeout(timer)
        this.removeListener('search', handler)
        resolve(result)
      }

      const handler = (line: string) => {
        if (line.startsWith('info')) {
          // Only parse lines that have both multipv and pv
          const multipvMatch = line.match(/multipv (\d+)/)
          const depthMatch = line.match(/depth (\d+)/)
          if (depthMatch) {
            searchDepth = parseInt(depthMatch[1], 10)
          }

          // Check for mate 0 (checkmate/stalemate) — no bestmove will follow.
          const mateMatch = line.match(/score mate (-?\d+)/)
          if (mateMatch && parseInt(mateMatch[1], 10) === 0) {
            finish([{ pv: [], mate: 0, depth: searchDepth ?? 0 }])
            return
          }

          if (multipvMatch) {
            const multipv = parseInt(multipvMatch[1], 10)
            const cpMatch = line.match(/score cp (-?\d+)/)
            // Extract PV moves: "pv e2e4 e7e5 ..."
            const pvMatch = line.match(/ pv (.+)$/)!
            const pvUci = pvMatch ? pvMatch[1].trim().split(/\s+/) : []

            lines.set(multipv, {
              pv: pvUci,
              cp: cpMatch ? toWhite(parseInt(cpMatch[1], 10)) : undefined,
              mate: mateMatch ? toWhite(parseInt(mateMatch[1], 10)) : undefined,
              depth: searchDepth,
            })
          }
        }

        if (line.startsWith('bestmove')) {
          // Build result array of length n, filling any missing PVs.
          const result: MultiPvLine[] = []
          for (let i = 1; i <= n; i++) {
            const entry = lines.get(i)
            if (entry) {
              result.push(entry)
            } else {
              result.push({ pv: [], depth: searchDepth })
            }
          }
          finish(result)
        }
      }

      this.addListener('search', handler)

      this.send(`setoption name MultiPV value ${n}`)
      this.send('ucinewgame')
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)

      const timer = setTimeout(() => {
        const result: MultiPvLine[] = []
        for (let i = 1; i <= n; i++) {
          const entry = lines.get(i)
          if (entry) {
            result.push(entry)
          } else {
            result.push({ pv: [], depth: searchDepth })
          }
        }
        finish(result)
      }, 10_000)
    }).finally(() => {
      // Reset MultiPV to 1 so other callers (Play page, getEvaluation, etc.)
      // are not affected.
      this.send('setoption name MultiPV value 1')
    })
  }

  /**
   * Set the engine's playing strength (0-20, where 20 is strongest).
   */
  setSkillLevel(level: number): void {
    if (!this.worker) {
      throw new Error('Stockfish not initialized')
    }
    this.send(`setoption name Skill Level value ${level}`)
  }

  destroy(): void {
    if (this.worker) {
      this.send('quit')
      this.worker.terminate()
      this.worker = null
    }
    this.listeners.clear()
  }
}
