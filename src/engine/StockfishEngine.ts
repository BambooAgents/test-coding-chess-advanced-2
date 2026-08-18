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
   */
  async getEvaluation(fen: string, depth = 6): Promise<StockfishResult> {
    if (!this.worker) {
      throw new Error('Stockfish not initialized. Call init() first.')
    }

    return new Promise<StockfishResult>((resolve) => {
      let bestMove = ''
      let ponder: string | undefined
      let score: number | undefined
      let searchDepth: number | undefined

      const handler = (line: string) => {
        if (line.startsWith('info')) {
          const depthMatch = line.match(/depth (\d+)/)
          if (depthMatch) {
            searchDepth = parseInt(depthMatch[1], 10)
          }
          const scoreMatch = line.match(/score cp (-?\d+)/)
          if (scoreMatch) {
            score = parseInt(scoreMatch[1], 10)
          }
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/)
          bestMove = parts[1] || '(none)'
          if (parts[3] && parts[3] !== '(none)') {
            ponder = parts[3]
          }
          this.removeListener('search', handler)
          resolve({
            bestMove,
            ponder,
            score,
            depth: searchDepth,
          })
        }
      }

      this.addListener('search', handler)

      this.send('ucinewgame')
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)
    })
  }

  /**
   * Get the best move for a given FEN position at a given depth.
   */
  async getBestMove(fen: string, depth = 10): Promise<StockfishResult> {
    if (!this.worker) {
      throw new Error('Stockfish not initialized. Call init() first.')
    }

    return new Promise<StockfishResult>((resolve) => {
      let bestMove = ''
      let ponder: string | undefined
      let score: number | undefined
      let searchDepth: number | undefined

      const handler = (line: string) => {
        // Parse info lines for score/depth
        if (line.startsWith('info')) {
          const depthMatch = line.match(/depth (\d+)/)
          if (depthMatch) {
            searchDepth = parseInt(depthMatch[1], 10)
          }
          const scoreMatch = line.match(/score cp (-?\d+)/)
          if (scoreMatch) {
            score = parseInt(scoreMatch[1], 10)
          }
        }

        // Parse bestmove
        if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/)
          bestMove = parts[1] || '(none)'
          if (parts[3] && parts[3] !== '(none)') {
            ponder = parts[3]
          }
          this.removeListener('search', handler)
          resolve({
            bestMove,
            ponder,
            score,
            depth: searchDepth,
          })
        }
      }

      this.addListener('search', handler)

      this.send('ucinewgame')
      this.send(`position fen ${fen}`)
      this.send(`go depth ${depth}`)
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
