# Research: Client-Side Chess.com Game Import

**Date:** 2025-08-18
**Task:** Investigate how a pure client-side SPA (GitHub Pages, no backend) can fetch a chess.com user's recent games by username, given the assumption that chess.com's pubapi does not send CORS headers.

## TL;DR — The premise was wrong: chess.com pubapi DOES send CORS headers

**The single most important finding of this research is that chess.com's pubapi fully supports CORS.** Every endpoint tested returns `Access-Control-Allow-Origin: *`, handles `OPTIONS` preflight correctly, and works from any origin. **No proxy, no backend, no workaround is needed.** A browser `fetch()` to `https://api.chess.com/pub/player/{username}/games/archives` works directly.

This was verified with live `curl` tests on 2025-08-18, including:
- Origin header simulation (`Origin: https://example.com`, `Origin: https://bambooagents.github.io`)
- Full `OPTIONS` preflight with `Access-Control-Request-Method: GET`
- Both JSON and PGN content-type endpoints

See the [Evidence](#evidence) section for the raw header captures.

## Comparison Table of Options

| Option | How it works | CORS-safe? | Reliability | Production-safe for GH Pages? | Needs approval? |
|--------|-------------|-----------|-------------|-------------------------------|-----------------|
| **1. Direct fetch to chess.com pubapi** | `fetch("https://api.chess.com/pub/player/{user}/games/archives")` then fetch monthly archive URLs | ✅ **Yes — confirmed live** `Access-Control-Allow-Origin: *` + preflight OK | ⭐⭐⭐⭐⭐ Best — direct, no intermediary | ✅ Yes — nothing to break | No |
| 2. corsproxy.io | `fetch("https://corsproxy.io/?url=...")` | ✅ adds CORS | ⭐ Free tier now requires paid plan for server-side requests | ❌ No — returned `{"error":"Server-side requests are not allowed on your plan"}` | No |
| 3. allorigins.win | `fetch("https://api.allorigins.win/raw?url=...")` | ✅ adds CORS | ⭐⭐ Free but frequently down (returned HTTP 522 in test) | ❌ No — unreliable, third-party dependency | No |
| 4. Cloudflare Worker / Pages Function | Deploy a tiny `fetch` proxy as a serverless function | ✅ | ⭐⭐⭐⭐⭐ Very reliable | ⚠️ **Needs user approval** — counts as "hosting something else" per user's "GitHub Pages and nothing else" constraint | **Yes — product decision** |
| 5. thingproxy / other free proxies | `fetch("https://thingproxy.freeboard.io/fetch/...")` | ✅ adds CORS | ⭐ Unreliable, often down, rate-limited | ❌ No | No |
| 6. Paste-PGN fallback | User pastes PGN text into a textarea | ✅ no fetch needed | ⭐⭐⭐⭐⭐ Always works | ✅ Yes | No |
| 7. Lichess username import | `fetch("https://lichess.org/api/games/user/{user}?max=N")` | ⚠️ CORS headers present (`Access-Control-Allow-Origin: *`) but **endpoint requires OAuth2 authentication** (security spec says `OAuth2: []`, anonymous requests return 404) | ⭐⭐⭐ CORS is fine, but auth is a blocker for pure client-side without a token | ⚠️ Partial — would need an OAuth token the user provides | Maybe |

## Recommendation (ranked by reliability for a GH Pages app)

### #1 — Direct fetch to chess.com pubapi (NO PROXY NEEDED)

**This is the clear winner.** chess.com pubapi sends `Access-Control-Allow-Origin: *` on all game endpoints, handles OPTIONS preflight, and serves both JSON and PGN formats. The app can do this entirely client-side:

```typescript
// 1. Get list of monthly archive URLs
const res = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`);
const { archives } = await res.json();

// 2. Fetch the most recent month's games (JSON with embedded PGNs)
const monthRes = await fetch(archives[archives.length - 1]);
const { games } = await monthRes.json();
// Each game has a .pgn field with full PGN text

// OR: Fetch as raw PGN (multiple games concatenated)
const pgnRes = await fetch(`${archives[archives.length - 1]}/pgn`);
const pgnText = await pgnRes.text();
```

**Rate limits:** chess.com pubapi has no fixed rate limit for serial requests. From their docs: "Your serial access rate is unlimited. If you always wait to receive the response to your previous request before making your next request, then you should never encounter rate limiting." Parallel requests may get 429s, so fetch months sequentially.

**Available endpoints (all CORS-enabled):**
- `GET /pub/player/{username}` — player profile
- `GET /pub/player/{username}/stats` — stats per time control
- `GET /pub/player/{username}/games/archives` — list of monthly archive URLs
- `GET /pub/player/{username}/games/{YYYY}/{MM}` — games for that month (JSON, each game has `.pgn` field)
- `GET /pub/player/{username}/games/{YYYY}/{MM}/pgn` — games as raw concatenated PGN text

### #2 — Paste-PGN fallback (always available, zero dependencies)

Regardless of the chess.com API working, the app should always support pasting PGN text. This makes the analysis feature work fully offline with any PGN source (chess.com export, lichess export, manual entry). This is a hard dependency-free fallback that should ship regardless.

### #3 — Lichess username import (nice-to-have, but auth-gated)

Lichess sends `Access-Control-Allow-Origin: *` on its API, but the **game export endpoint (`/api/games/user/{username}`) requires OAuth2 authentication** — anonymous requests return 404. The lichess **cloud-eval** endpoint (`/api/cloud-eval?fen=...`) does work anonymously and is CORS-enabled, so it could supplement Stockfish-WASM for opening positions. But full game import by username from lichess would need the user to provide an OAuth token, which complicates the "pure static SPA" model. **Recommend deferring lichess import to a later phase** and keeping paste-PGN as the universal fallback.

### Not recommended — Public CORS proxies

- **corsproxy.io**: Now requires a paid plan for server-side requests. Returned `{"error":"Server-side requests are not allowed on your plan"}`.
- **allorigins.win**: Returned HTTP 522 (connection timed out) during testing.
- **thingproxy**: Known to be unreliable and rate-limited.
- All public CORS proxies add a third-party dependency that can break at any time, change terms, or rate-limit a public app. **Not production-safe for a public GitHub Pages app.** And since chess.com already supports CORS directly, they are completely unnecessary.

### Not recommended — Cloudflare Worker / serverless proxy

A free Cloudflare Worker could proxy chess.com requests, but:
1. **It counts as "hosting something else"** — the user explicitly said "hosted on GitHub Pages and nothing else."
2. It's **unnecessary** since chess.com pubapi already supports CORS.
3. If a proxy were ever needed for a different API, this would need explicit user approval as a product decision.

## What needs human approval

**Nothing.** The primary finding eliminates the need for any proxy, backend, or serverless function. The app can fetch chess.com games directly from the browser. The only item that *would* have needed approval (a serverless proxy) is no longer necessary.

If the team later wants lichess game import by username, that would need a decision about whether to ask users for an OAuth token (acceptable UX hit for a static SPA).

## Lichess fallback note

- **Lichess cloud-eval** (`GET /api/cloud-eval?fen=...`): ✅ Works anonymously, CORS-enabled, returns JSON with depth, knodes, and principal variation. Could supplement or validate Stockfish-WASM analysis for common opening positions. Verified live:
  ```json
  {"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
   "knodes":695524,"depth":75,
   "pvs":[{"moves":"e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 e1h1 d7d6","cp":19}]}
  ```
- **Lichess game export** (`GET /api/games/user/{username}`): ❌ Requires OAuth2. Anonymous requests return 404 despite CORS headers being present. Not usable in a pure static SPA without user-provided tokens.
- **Lichess puzzle database**: Available at `https://database.lichess.org/lichess_db_puzzle.csv.zst` (304 MB compressed, CC0 license). CORS headers on `database.lichess.org` not tested, but the file is large enough that the app would bundle a curated subset rather than fetch it at runtime.

## Pure-paste-PGN fallback

✅ **Confirmed viable.** The app can always work fully offline by accepting pasted PGN text. This is the universal fallback that works with any PGN source (chess.com manual export, lichess export, typed-in games). The username-import feature is a nice-to-have convenience layer on top, not a hard dependency. The analysis page should support both paths:
1. Enter chess.com username → fetch games directly via pubapi (no proxy)
2. Paste PGN text → analyze directly

## Evidence

### chess.com pubapi CORS headers (live capture, 2025-08-18)

**Archives endpoint with Origin header:**
```
$ curl -sI -H "Origin: https://example.com" "https://api.chess.com/pub/player/hikaru/games/archives"
HTTP/2 200
content-type: application/json; charset=utf-8
access-control-allow-origin: *
```

**OPTIONS preflight:**
```
$ curl -sI -X OPTIONS -H "Origin: https://example.com" -H "Access-Control-Request-Method: GET" \
  "https://api.chess.com/pub/player/hikaru/games/archives"
HTTP/2 200
access-control-allow-origin: *
access-control-allow-methods: GET, OPTIONS
access-control-max-age: 86400
access-control-allow-headers: Origin
```

**Monthly archive (JSON, with embedded PGNs):**
```
$ curl -sI -H "Origin: https://example.com" "https://api.chess.com/pub/player/hikaru/games/2024/01"
HTTP/2 200
content-type: application/json; charset=utf-8
content-length: 4355989
access-control-allow-origin: *
```

**Monthly archive PGN endpoint:**
```
$ curl -sI -H "Origin: https://example.com" "https://api.chess.com/pub/player/hikaru/games/2024/01/pgn"
HTTP/2 200
content-type: application/vnd.chess-pgn; charset=utf-8
access-control-allow-origin: *
```

**Player stats endpoint:**
```
$ curl -sI -H "Origin: https://example.com" "https://api.chess.com/pub/player/hikaru/stats"
HTTP/2 200
content-type: application/json; charset=utf-8
access-control-allow-origin: *
```

### chess.com rate limiting (from official docs)

> "Your serial access rate is unlimited. If you always wait to receive the response to your previous request before making your next request, then you should never encounter rate limiting. However, if you make requests in parallel [...] some requests may be blocked depending on how much work it takes to fulfill your previous request. You should be prepared to accept a 429 Too Many Requests response."

Source: https://www.chess.com/news/view/published-data-api

### CORS proxy tests (showing they are unnecessary and unreliable)

```
$ curl -s "https://corsproxy.io/?https://api.chess.com/pub/player/hikaru/games/archives"
{"error":"Server-side requests are not allowed on your plan. Upgrade at https://corsproxy.io/pricing/"}

$ curl -s "https://api.allorigins.win/raw?url=https://api.chess.com/pub/player/hikaru/games/archives"
error code: 522
```

### Lichess cloud-eval (working, CORS-enabled)

```
$ curl -s --data-urlencode "fen=rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" \
  -G "https://lichess.org/api/cloud-eval"
{"fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
 "knodes":695524,"depth":75,
 "pvs":[{"moves":"e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 d2d3 f8c5 e1h1 d7d6","cp":19}]}
```

### Lichess game export (requires OAuth2 — not usable anonymously)

```
$ curl -s -H "Accept: application/x-chess-pgn" "https://lichess.org/api/games/user/thibault?max=2"
HTTP/2 404  (returns HTML 404 page, not JSON error)
```

The OpenAPI spec confirms: `security: - OAuth2: []` — authentication is required.

### Lichess puzzle database

```
$ curl -sI "https://database.lichess.org/lichess_db_puzzle.csv.zst"
HTTP/2 200
content-type: application/octet-stream
content-length: 304384407  (~304 MB compressed)
```

Format: CSV with columns `PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags,DailyDate`. License: CC0 (public domain).

## Source links

- chess.com pubapi documentation: https://www.chess.com/news/view/published-data-api
- chess.com pubapi support article: https://support.chess.com/en/articles/9650547-what-is-the-pubapi-and-how-do-i-use-it
- chess.com pubapi OpenAPI spec (games): https://raw.githubusercontent.com/api-evangelist/chess-com/refs/heads/main/openapi/chess-com-games-api-openapi.yml
- chess.com pubapi OpenAPI spec (players): https://raw.githubusercontent.com/api-evangelist/chess-com/refs/heads/main/openapi/chess-com-players-api-openapi.yml
- Lichess API OpenAPI spec (cloud-eval): https://raw.githubusercontent.com/lichess-org/api/master/doc/specs/tags/analysis/api-cloud-eval.yaml
- Lichess API OpenAPI spec (games export): https://raw.githubusercontent.com/lichess-org/api/master/doc/specs/tags/games/api-games-user-username.yaml
- Lichess API main spec: https://raw.githubusercontent.com/lichess-org/api/master/doc/specs/lichess-api.yaml
- Lichess database repo: https://github.com/lichess-org/database
- Lichess database README: https://raw.githubusercontent.com/lichess-org/database/master/README.md
- Lichess puzzle export script: https://raw.githubusercontent.com/lichess-org/database/master/export-puzzle.sh
- corsproxy.io pricing (now paid for server-side): https://corsproxy.io/pricing/
- react-chess-analysis-board (13★): https://github.com/ps2-controller/react-chess-analysis-board
- Fairy-Stockfish browser playground (33★): https://github.com/ianfab/fairyground
- Botvinnik (browser-only chess, Stockfish WASM, 3★): https://github.com/quadrismegistus/botvinnik
- solid-apps/stockfish (browser Stockfish, static, 1★): https://github.com/solid-apps/stockfish
