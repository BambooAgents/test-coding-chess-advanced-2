# Brilliant (??) Move Heuristic Specification

> **APPROXIMATION NOTICE**: Chess.com's brilliant-move algorithm is proprietary.
> This document specifies a heuristic approximation assembled from multiple
> open-source reverse-engineering efforts. It is labelled as an approximation
> and will not match chess.com's classification exactly. It aims for
> reasonable precision (avoid false positives) over recall (catching every
> real brilliant move), because false brilliants are more damaging to user
> trust than missed ones.

## Sources

This spec synthesises findings from four OSS projects that reverse-engineer
chess.com's brilliant classification:

1. **`jsantos15/firstmove`** — `packages/core/src/coach/tacticalSignals.ts` +
   `scripts/accuracy-research/calibrate-brilliant.js`. The most sophisticated
   attempt: calibrated against 35 real chess.com-analyzed games with knob
   sweeps. Uses SEE (Static Exchange Evaluation), MultiPV "only-move" margin,
   poison-bait detection, and bystander-vs-self-sacrifice distinction.
   Thresholds tuned to minimise false positives.
   https://github.com/jsantos15/firstmove

2. **`WintrCat/wintrchess`** — `shared/src/lib/reporter/classification/brilliant.ts`.
   A production app. Checks that the move leaves the mover's own pieces in
   danger (genuine sacrifice), doesn't move pieces to safety, and the
   position isn't "protected" by equal-or-greater counterthreats.
   https://github.com/WintrCat/wintrchess

3. **`galfrevn/brillant`** — `core/brilliant.py` + `core/tactics.py`. A
   hackathon project with a clean four-criterion model: sacrifice + uniquely
   good (eval gap > 80cp) + non-obvious (not mate-in-1, not recapture, not
   only-checking-move) + positive outcome (eval >= -200cp).
   https://github.com/galfrevn/brillant

4. **`Daytoo77/chesslab`** — `docs/move-classification-report.md`. A detailed
   research report covering WPL-based thresholds, the sequential priority
   queue, and the brilliant heuristic framework (sacrifice + solvency +
   non-triviality). Also covers the ICCC 2024 study on non-obviousness and
   the Maia-vs-Stockfish evaluation discrepancy as a signal of brilliance.
   https://github.com/Daytoo77/chesslab

Additional context:
- **Lichess `Advice.scala`** — the Lichess classification thresholds use a
  -1 to +1 winning-chance scale; a drop of 0.3 = blunder, 0.2 = mistake, 0.1 =
  inaccuracy. Brilliant is not classified by Lichess (only by chess.com).
- **ICCC 2024 study** — a move is more likely to be perceived as brilliant
  when a human-like engine (Maia) rates it poorly but a strong engine
  (Stockfish) rates it highly. This "surprise gap" is a useful secondary
  signal but requires two engines, which we cannot run in-browser
  practically. We note it as a future enhancement.

## Algorithm Overview

A move is classified **Brilliant (??)** if and only if **all** of the
following conditions are met. The checks are ordered cheapest-first to allow
early exit.

### Rule 1: The move must be the engine's top choice (firm, not a knob)

The played move must match the engine's best move (UCI format) at the
analysis depth. This is verified by comparing the played move's UCI string
against Stockfish's `bestmove` output for the pre-move FEN.

**Why firm**: A move that isn't the engine's top choice can't be brilliant —
it's just the best of several options, not a uniquely difficult find.

**Implementation**: `played_uci === engine_bestmove_uci` (exact match,
including promotion suffix).

### Rule 2: The move hangs a piece worth ≥ 3 (a real net sacrifice)

After the move is played, the opponent must have a profitable capture of a
piece worth ≥ 3 points (knight, bishop, rook, queen — no pawn sacrifices).
This is detected via SEE (Static Exchange Evaluation):

1. Find all opponent captures on the post-move board where the captured
   piece has value ≥ 3.
2. For each, compute the SEE profit: `captured_value - see_gain_on_square`
   (where `see_gain_on_square` is the opponent's net material after the
   best recapture sequence on that square).
3. The bait is the highest-profit such capture.

**Additional constraints**:
- `bait.profit >= seeThreshold` (default: **1** — opponent gains at least 1
  point of material by capturing).
- `bait.profit - moved_captured_value >= netSacMin` (default: **1** — must be
  a net sacrifice, not a trade. If the move itself captured a piece worth 3
  and then hangs a piece worth 3, the net is 0, which is a trade, not a
  sacrifice).

**Staleness check**: The bait must be fresh — not a piece that was already
hanging before the opponent's previous move. If the same profitable capture
existed before the opponent's last move (checked by making a null move on
the pre-opponent-move FEN), the bait is stale and the move is not brilliant.
This prevents flagging moves where a hanging piece was just sitting idle
for a full round.

### Rule 3: The mover's position is not already lost after the move

The mover's win percentage after the move must be ≥ `minWinAfterPct`
(default: **40%**). This prevents flagging desperate sacrifices in
already-lost positions — the "only move that loses slowest" pattern.

**Implementation**: Convert the post-move eval (white-POV centipawns) to
win% using the Lichess sigmoid:
```
winPct = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)
```
Then check from the mover's perspective: `moverWinPct >= 40`.

### Rule 4: The sacrifice achieves brilliance via one of two mechanisms

After rules 1-3, the move qualifies as brilliant if **either** of these
two mechanisms holds:

#### Mechanism A: Poisoned Bait

The opponent loses significantly by capturing the bait. Compute the
"taker's loss": the eval difference (from the taker's perspective) between
declining the capture (leaving the position as-is after the brilliant move)
and actually capturing the bait.

```
takerLoss = (takerSign * evalAfterMoveCp) - (takerSign * evalAfterCaptureCp)
```

If `takerLoss >= poisonLossCp` (default: **300cp**), the capture is
"poisoned" — the opponent does worse by taking the bait. This includes
forced-mate cases (mate scores read as huge losses via the mate-score
convention).

**Engine calls required**: One eval on the post-capture FEN (the position
after the opponent takes the bait).

#### Mechanism B: Only Move

The move is the only one that doesn't lose significantly. Compute the
"only-move margin": how much better the played move is than the second-best
legal move, from the mover's perspective.

```
onlyMoveMargin = moverSign * (pv1_eval - pv2_eval)
```

If `onlyMoveMargin >= onlyMoveMarginCp` (default: **150cp**), this is an
"only move" — every alternative is meaningfully worse.

**Self-sacrifice vs. bystander bait distinction**:
- **Self-sacrifice** (the hanging piece IS the piece that just moved, e.g.
  Nxe6+ hanging the knight on e6): the only-move margin alone is sufficient
  evidence. The point is survival, not punishing the capture.
- **Bystander bait** (the hanging piece was already loose, not the moved
  piece): being the engine's best by a margin says nothing about whether
  the bystander bait is actually worth avoiding. For bystander baits, the
  capture must be **decisive** for the taker: the taker's own win% after
  capturing must be ≤ `bystanderTakerMaxWinPct` (default: **10%**). This
  separates a real brilliant bystander bait (taker is crushed after
  capturing, e.g. 0.06%) from an incidental one (taker is merely worse,
  e.g. 11%).

**Engine calls required**: MultiPV with N=2 on the pre-move FEN (to get
pv1 and pv2 evals).

### Rule 5 (galfrevn-inspired, optional): Non-obviousness filter

As an additional guard against false positives, exclude moves that are
"obvious" by these cheap structural checks (no engine call needed):

- **Mate in 1**: If the move delivers checkmate, classify as Best, not
  Brilliant.
- **Trivial recapture**: If the move recaptures on the same square as the
  opponent's last move, it's a recapture, not a sacrifice (already covered
  by Rule 2's net-sac check, but this is a cheaper pre-filter).
- **Only checking move**: If the move gives check and is the only legal
  move that gives check, it's forced, not brilliant.

These are already partially covered by Rules 1-2 but add a cheap early exit.

## Default Thresholds (calibrated)

Based on `jsantos15/firstmove`'s calibration against 35 real chess.com games:

| Parameter | Default | Meaning |
|---|---|---|
| `seeThreshold` | 1 | Opponent's minimum static profit for the bait to count |
| `netSacMin` | 1 | Bait profit minus material the move itself captured |
| `poisonLossCp` | 300 | Taker's loss (cp, their POV) for "poisoned" classification |
| `onlyMoveMarginCp` | 150 | How far ahead of 2nd-best the move must be (cp, mover POV) |
| `bystanderTakerMaxWinPct` | 10 | For bystander baits: taker's max win% after capturing |
| `minWinAfterPct` | 40 | Mover's min win% after the move (not already lost) |

These are deliberately conservative (precision-favoring). The calibration
showed that lowering `minWinAfterPct` floods false positives with desperate
sacrifices in already-lost positions.

## Pseudocode

```typescript
function isBrilliant(
  fenBeforeMove: string,
  playedSan: string,
  playedUci: string,
  engineBestmove: string,       // Stockfish bestmove for fenBeforeMove
  multiPvLines: Array<{evalCp: number}>,  // PV1 and PV2 evals, white-POV
  evalAfterMoveWhiteCp: number,  // White-POV eval after the played move
  evalAfterCaptureWhiteCp: number | null, // White-POV eval after opponent takes bait (null if not computed yet)
  fenBeforeOpponentsPriorMove: string | undefined,
  mover: 'white' | 'black',
  thresholds = DEFAULT_THRESHOLDS,
): boolean {
  // Rule 1: Must be engine's top choice
  if (playedUci !== engineBestmove) return false;

  // Rule 5 (cheap pre-filter): Non-obviousness
  // (mate-in-1, trivial recapture, only-checking-move — check before expensive rules)
  // ... (structural checks, see Rule 5 above) ...

  // Rule 3: Position not already lost
  const moverCpAfter = mover === 'white' ? evalAfterMoveWhiteCp : -evalAfterMoveWhiteCp;
  if (winPercent(moverCpAfter) < thresholds.minWinAfterPct) return false;

  // Rule 2: Find hanging piece bait (SEE-based)
  const bait = findHangingPieceBait(fenAfterMove);
  if (!bait) return false;
  if (bait.profit < thresholds.seeThreshold) return false;
  if (bait.profit - movedCapturedValue < thresholds.netSacMin) return false;

  // Staleness check
  if (fenBeforeOpponentsPriorMove && baitWasStale(fenBeforeOpponentsPriorMove, bait.to)) {
    return false;
  }

  // Rule 4: Check brilliance mechanism
  const isSelfSacrifice = (bait.to === playedUci.slice(2, 4));

  // Mechanism A: Poisoned bait
  if (evalAfterCaptureWhiteCp !== null) {
    const takerLoss = computeTakerLoss(mover, evalAfterMoveWhiteCp, evalAfterCaptureWhiteCp);
    if (takerLoss >= thresholds.poisonLossCp) return true;
  }

  // Mechanism B: Only move
  const onlyMoveMargin = computeOnlyMoveMargin(mover, multiPvLines);
  const isOnlyMove = onlyMoveMargin !== null && onlyMoveMargin >= thresholds.onlyMoveMarginCp;

  if (isSelfSacrifice && isOnlyMove) return true;

  if (!isSelfSacrifice && isOnlyMove) {
    // Bystander bait: capture must be decisive for taker
    if (evalAfterCaptureWhiteCp !== null) {
      const takerWinPct = winPercent(mover === 'white' ? -evalAfterCaptureWhiteCp : evalAfterCaptureWhiteCp);
      if (takerWinPct <= thresholds.bystanderTakerMaxWinPct) return true;
    }
  }

  return false;
}
```

## Engine Call Budget

For each candidate move (moves that pass the cheap pre-filters), the
algorithm needs:

1. **Bestmove** on pre-move FEN (depth D) — 1 call. [Rule 1]
2. **MultiPV N=2** on pre-move FEN (depth D) — 1 call. [Rule 4B, only-move margin]
3. **Eval** on post-capture FEN (depth D) — 1 call. [Rule 4A, poison check]

Total: 3 engine calls per candidate move. Candidates are pre-filtered by
SEE (cheap, no engine) so only a handful of moves per game reach this stage.

For the weak-spot analysis page (low-depth, all games), brilliant detection
can be skipped or run at reduced depth — the primary purpose of weak-spot
analysis is aggregate patterns, not per-move annotations.

## Classification Priority

Brilliant is checked in the classification priority queue **after** book,
mate, and missed-mate checks, but **before** the standard WPL/eval-delta
classifications (best, excellent, good, inaccuracy, mistake, blunder). This
ensures a brilliant sacrifice is never downgraded to "best" or "good" just
because the eval delta is small.

Priority order (from `Daytoo77/chesslab`):
1. Book (opening theory lookup)
2. Checkmate delivered → Best
3. Missed forced mate → Miss
4. **Brilliant** (this heuristic)
5. Best (engine top choice, WPL = 0)
6. Missed win → Miss
7. Blunder (WPL ≥ 0.20)
8. Mistake (WPL 0.10–0.20)
9. Inaccuracy (WPL 0.05–0.10)
10. Good (WPL 0.02–0.05)
11. Excellent (WPL < 0.02)
12. Great (fallback: 15% win% gain over 2nd-best)

## Test Positions

### SHOULD be classified Brilliant

**T1: Greek Gift Bishop Sacrifice (Bxh7+)**
- **FEN before move**: `r1bqk2r/ppp2ppp/2n5/3np3/2B1Pn2/5N2/PPPP1PPP/RNBQ1RK1 w kq - 4 7`
  (A position where Bxh7+ is the engine's top move, sacrificing the bishop)
- **Move**: Bxh7+
- **Why brilliant**: Sacrifices a bishop (value 3) on h7, no immediate
  recapture, the king must take (Kxh7), after which the position is winning
  for White via a follow-up knight jump (Ng5+) and queen attack. The
  opponent's capture (Kxh7) is "poisoned" — taking the bishop leads to a
  losing attack. Eval gap to second-best is large. This is a self-sacrifice
  + poisoned bait.
- **Expected mechanism**: Mechanism A (poisoned bait), self-sacrifice.

**T2: Exchange Sacrifice for Initiative (Rxe6 or similar)**
- **FEN before move**: `r4rk1/pp3pp1/2n1bn1p/q1pp4/3P4/2P1PN2/PPB2PPP/RN1QKB1R w K - 0 1`
  (A position where sacrificing a rook for a knight opens a decisive attack)
- **Move**: Rxe6 (rook takes knight, then hangs to a pawn recapture)
- **Why brilliant**: Gives up the exchange (rook for knight), the recapture
  (fxe6) leaves White with a crushing positional advantage. The eval after
  declining (not taking the rook) is significantly better for White than
  after taking. Self-sacrifice + only-move (every other move is
  significantly worse).
- **Expected mechanism**: Mechanism B (only move, self-sacrifice), possibly
  also Mechanism A (poison).

**T3: Quiet Move in Tactical Position (non-sacrifice "only move")**
- **FEN before move**: `6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1` (simplified —
  a position where a quiet preparatory move is the only one that holds)
- **Note**: This is the hardest case for the heuristic — a brilliant move
  that does NOT involve a material sacrifice but is the only move that
  maintains equality. Our algorithm as specified requires a hanging piece
  bait (Rule 2), so pure "only move" brilliant moves without a sacrifice
  would NOT be caught. This is a known limitation — see "Limitations"
  below. Chess.com does classify some non-sacrifice moves as brilliant,
  but the vast majority involve a sacrifice. We prioritize precision.

### SHOULD NOT be classified Brilliant

**N1: Trivial recapture after winning material**
- **FEN before move**: Any position where White just won a queen and now
  must recapture on the same square.
- **Move**: e.g., Qxa8 recapturing after Qxa8 was the previous move.
- **Why not brilliant**: This is a recapture (Rule 5 filter), the net
  sacrifice is 0 (Rule 2), and the move is obvious. Should classify as Best.

**N2: Best move in a completely winning position (+15.00)**
- **FEN before move**: A position where White is up a queen and two pawns,
  eval = +15.00, and the best move happens to involve giving back a minor
  piece for a forced mate.
- **Move**: e.g., Nf7+ sacrificing a knight for mate in 3.
- **Why not brilliant**: The position is already completely winning
  (win% > 95%). The sacrifice requires no special insight — any engine
  move would win. The `minWinAfterPct` check doesn't explicitly cover this
  (it checks post-move, not pre-move), but in practice the eval gap to
  second-best is tiny (many moves win), so the only-move margin check
  fails. Additionally, the chesslab report notes chess.com checks
  "non-triviality / pre-existing state" — the player must not already be
  in a completely winning position. We could add a pre-move win% ceiling
  (e.g., `maxWinBeforePct: 90`) as a future refinement.

**N3: Desperate sacrifice in a lost position**
- **FEN before move**: A position where White is down a queen (eval =
  -8.00), and the best move sacrifices a rook to create some counterplay.
- **Move**: e.g., Rxg7+ sacrificing a rook.
- **Why not brilliant**: After the move, White is still lost (win% < 40%).
  Rule 3 (`minWinAfterPct >= 40`) filters this out. The calibration in
  firstmove confirmed this guard is essential — without it, desperate sacs
  in lost positions flood the results.

**N4: Obvious check / forced move**
- **FEN before move**: A position where the only legal move that gives
  check is Qxh7+.
- **Move**: Qxh7+
- **Why not brilliant**: Rule 5 filters out "only checking move." The move
  is forced/obvious, not brilliant.

**N5: Simple developing move (no sacrifice)**
- **FEN before move**: Opening position, e.g., after 1.e4 e5 2.Nf3 Nc6.
- **Move**: Bb5 (Ruy Lopez)
- **Why not brilliant**: No sacrifice (Rule 2 fails), no hanging piece.
  Should classify as Book.

## Limitations

1. **No pre-move win% ceiling**: We check that the position is not already
   lost after the move (`minWinAfterPct`), but we don't check that the
   position was not already won before the move. A refinement would add
   `maxWinBeforePct` (e.g., 90%) — if the mover was already winning at
   >90%, a sacrifice isn't brilliant, it's just converting. This is noted
   for the implementation ticket.

2. **Non-sacrifice brilliant moves**: Our algorithm requires a material
   sacrifice (hanging piece bait, Rule 2). Chess.com classifies some
   non-sacrifice moves as brilliant (e.g., a quiet defensive move that's
   the only move to hold). These will be classified as "Great" (the
   only-move → great path) rather than Brilliant. This is an acceptable
   trade-off for precision.

3. **No Elo-based threshold adjustment**: Chess.com adjusts brilliant
   thresholds based on player rating (more generous for lower-rated
   players). We use fixed thresholds. This could be added later if player
   rating is available from the PGN headers.

4. **No Maia cross-check**: The ICCC 2024 study showed that the gap
   between a human-like engine (Maia) and Stockfish is a strong predictor
   of perceived brilliance. Running two engines in-browser is impractical
   for v1, but a future enhancement could use a lightweight Maia model.

5. **Depth sensitivity**: Brilliant detection requires sufficient engine
   depth (the firstmove calibration used depth 20). At the shallow depths
   used by the weak-spot analysis page, brilliant detection should be
   skipped or results marked as "low confidence." The analyze page should
   use depth ≥ 18.

6. **En passant edge cases**: The sacrifice detection and SEE logic must
   correctly handle en passant captures. The `galfrevn/brillant`
   implementation shows the pattern: check `is_en_passant` when the
   captured piece is None on the destination square.

## Implementation Notes for the Build Ticket

- Use `chess.js` for board manipulation, move generation, and FEN handling
  (mature, MIT-licensed, already in the stack).
- SEE (Static Exchange Evaluation) can be implemented with a simple
  recursive recapture loop — see `findHangingPieceBait` in firstmove's
  `tacticalSignals.ts` for reference.
- MultiPV: Stockfish-WASM supports `setoption name MultiPV value N` — use
  N=2 for the only-move margin.
- Win% sigmoid: `50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)` — the
  Lichess formula, used across all OSS implementations.
- Mate scores: convert to large centipawn values for the sigmoid (e.g.,
  `sign * (100000 - min(abs(mate), 999))`).
- The `baitWasStaleBeforeOpponentsMove` check requires making a "null
  move" (switching side to move). In chess.js this is done by modifying
  the FEN's side-to-move field and clearing en passant. Guard against
  positions where the null move is illegal (king in check).
