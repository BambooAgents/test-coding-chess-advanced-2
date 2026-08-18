# Chess Advanced

A pure client-side chess app for game analysis, puzzles, and weak-spot analysis. Built with Vite + React + TypeScript, using Stockfish compiled to WebAssembly running entirely in the browser. No backend — deployed as a static site on GitHub Pages.

## Scaffold for issue #12

This is the project scaffold established by issue [#12](https://github.com/BambooAgents/test-coding-chess-advanced-2/issues/12).

## Prerequisites

- **Node.js:** 20 (see `.nvmrc`)
- **npm** (comes with Node.js)

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:5183
npm test           # run Vitest unit tests
npm run test:e2e   # run Playwright e2e tests (needs `npx playwright install` first)
npm run lint       # run ESLint
npm run typecheck  # run TypeScript type-checking (tsc -b)
npm run build      # typecheck + production build to dist/
npm run preview    # preview the production build locally
```

## Tech stack & version pins

| Tool | Version |
|------|---------|
| Node.js | 20 |
| React | 19 |
| TypeScript | 5.9 |
| Vite | 6 |
| Vitest | 3.2 |
| Playwright | 1.62 |
| ESLint | 9 |
| styled-components | 6 |

## GitHub Pages base path

The app is configured with `base: '/test-coding-chess-advanced-2/'` in `vite.config.ts` for GitHub Pages subpath hosting at `https://bambooagents.github.io/test-coding-chess-advanced-2/`.

## Stockfish WASM

Stockfish is loaded as a Web Worker from `public/stockfish/stockfish.wasm.js`. The WASM binary (`stockfish.wasm`) is served from the same directory. The engine communicates via the UCI protocol through `src/engine/StockfishEngine.ts`.

## Lichess CBurnett pieces

Piece SVGs from the [Lichess CBurnett set](https://github.com/lichess-org/lila/tree/master/public/piece/cburnett) are bundled in `public/pieces/`.

## License

Stockfish is GPL-3.0. All other code is proprietary.
