/**
 * Stockfish Web Worker entry point.
 *
 * This file is loaded as a Web Worker. It imports stockfish.js and bridges
 * messages between the main thread and the Stockfish engine.
 */

// Import stockfish.js — this provides the WASM engine
import Stockfish from 'stockfish.js'

let engine = null

// Stockfish.js loads as a function that takes a message handler
self.onmessage = (e) => {
  const msg = typeof e.data === 'string' ? e.data : ''

  if (!engine) {
    // Initialize the engine
    engine = Stockfish()
    // Route engine output back to the main thread
    engine.onmessage = (event) => {
      const line = typeof event.data === 'string' ? event.data : ''
      if (line) {
        self.postMessage(line)
      }
    }
  }

  // Forward commands to the engine
  if (msg) {
    // stockfish.js uses a postMessage-style interface
    if (engine.postMessage) {
      engine.postMessage(msg)
    }
  }
}
