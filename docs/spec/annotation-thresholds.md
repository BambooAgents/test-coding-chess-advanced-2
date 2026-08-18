# Annotation Thresholds Spec

> **Ticket:** [#9 — Analyze: eval-delta annotation thresholds](https://github.com/BambooAgents/test-coding-chess-advanced-2/issues/9)
> **Status:** Resolved (research) — ready for implementation
> **Scope:** The 6 eval-delta-based move classifications: book, great, good, inaccuracy, mistake, blunder. Brilliant (‼) is NOT covered here — see `brilliant-heuristic.md` (ticket #10).

---

## 1. Winning-Chance Model (canonical)

All thresholds are expressed in **winning-chance delta** (Δ), not raw centipawns. This is the lichess approach and is more robust than raw cp because it accounts for the diminishing returns of extra centipawns in already-winning/losing positions.

### 1.1 Winning-Chances Formula

From [lichess-org/lila PR #11148](https://github.com/lichess-org/lila/pull/11148) and [scalachess `eval.scala`](https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/eval.scala):

```typescript
// Clamp cp to [-1000, 1000] before computing
const MULTIPLIER = -0.00368208;
function winningChances(cp: number): number {
  return 2 / (1 + Math.exp(MULTIPLIER * cp)) - 1;
}
// Returns [-1, +1]: +1 = infinitely winning, -1 = infinitely losing
```

### 1.2 Mate-to-Winning-Chances

From [lila `winningChances.ts`](https://github.com/lichess-org/lila/blob/master/ui/lib/src/ceval/winningChances.ts):

```typescript
function mateWinningChances(mate: number): number {
  const cp = (21 - Math.min(10, Math.abs(mate))) * 100;
  const signed = cp * (mate > 0 ? 1 : -1);
  return winningChances(signed);
}
```

### 1.3 Winning-Chance Delta (per move)

The delta is computed from the **player's perspective**:

```typescript
// e1 = eval before the move (from the player's POV)
// e2 = eval after the move (from the player's POV)
// color = the player's color
function povChances(color: Color, ev: EvalScore): number {
  return color === 'white' ? evalWinningChances(ev) : -evalWinningChances(ev);
}
function povDiff(color: Color, e1: EvalScore, e2: EvalScore): number {
  return (povChances(color, e1) - povChances(color, e2)) / 2;
}
// delta ranges from -1 (catastrophic loss) to +1 (brilliant gain)
// A negative delta means the move worsened the player's position
```

### 1.4 Win-Probability %

For display and for the Chess Review Engine-style thresholds, convert winning chances to a 0-100% scale:

```typescript
function winPercent(cp: number): number {
  return 50 + 50 * winningChances(clamp(cp, -1000, 1000));
}
```

---

## 2. Classification Thresholds

We adopt a **hybrid model**: lichess's winning-chance delta for the 3 core negative classifications (inaccuracy / mistake / blunder), and the Chess Review Engine's win-probability-loss bands for the positive classifications (book / great / good). This gives us chess.com-style granularity (7 badges) while grounding the negative classifications in the battle-tested lichess formula.

### 2.1 Negative Classifications (lichess-based, winning-chance delta)

Source: [lila `Advice.scala` `CpAdvice`](https://github.com/lichess-org/lila/blob/master/modules/tree/src/main/Advice.scala)

| Classification | Glyph | Winning-chance Δ (negative = worse) | Win-prob loss (approx) |
|---|---|---|---|
| **Inaccuracy** | `?!` | Δ ≤ **-0.10** | ~10% loss |
| **Mistake** | `?` | Δ ≤ **-0.20** | ~20% loss |
| **Blunder** | `??` | Δ ≤ **-0.30** | ~30% loss |

**Algorithm:**
```
delta = povDiff(color, evalBefore, evalAfter)  // negative = position worsened
if delta <= -0.30: return BLUNDER
if delta <= -0.20: return MISTAKE
if delta <= -0.10: return INACCURACY
// otherwise, check positive classifications
```

**Note:** lichess uses only these 3 negative tiers. The delta is the **drop** in winning chances caused by the played move vs. the best move. The lichess code finds the first threshold that `d <= delta` (where delta is negative), i.e. the most severe match wins.

### 2.2 Positive Classifications (win-probability-loss bands)

Source: [Chess Review Engine `classification.py`](https://github.com/H0NEYP0T-466/ChessReviewEngine/blob/master/backend/app/engine/classification.py)

These classify moves that are **not** blunders — they range from "best move" to "decent but not best":

| Classification | Glyph | Win-prob loss | Centipawn loss (approx) | Condition |
|---|---|---|---|---|
| **Best** | `!` | 0–2.5% | 0–10cp | Played move = engine's #1, OR within 2.5% win-prob of best |
| **Great** | `!!` | 0–2.5% | 0–10cp | Played move = engine's #1 AND contextual (after opponent's error, or continuation of brilliant) — see §2.4 |
| **Good** | (none) | 2.5–8% | 10–50cp | Decent alternative, minor eval loss |
| **Book** | (theory) | 0–2% | 0–20cp | Opening phase + move matches known theory (see §2.3) |

**Algorithm (after negative checks pass, i.e. delta > -0.10):**
```
winLossPct = winPercent(bestEval) - winPercent(playedEval)  // 0–100

if isBook: return BOOK          // see §2.3
if isBestMove: return BEST      // or GREAT if contextual — see §2.4
if winLossPct <= 2.5: return BEST  // very close to best
if winLossPct <= 8.0: return GOOD
// If we reach here, delta > -0.10 but winLossPct > 8%
// This means the move is between inaccuracy and good — classify as INACCURACY
// (the boundary: winLossPct > 8% ≈ winning-chance delta < -0.10)
return INACCURACY
```

### 2.3 Book (Opening Theory) Detection

"Book" is NOT an eval-delta classification — it's a lookup. Two strategies, in priority order:

1. **Opening database lookup** (preferred): Check if the move appears in a bundled opening book (e.g. a curated ECO/PGN tree). If the position is in the opening phase (first ~10 moves, or before the position leaves known theory) and the played move is in the book, classify as **Book**.

2. **Eval-match fallback** (when no book is bundled): If the position is in the opening phase (ply ≤ 20) AND the eval loss is ≤ 2% win-prob (≈ 20cp), classify as **Book**. This is the Chess Review Engine's approach.

**Recommended for v1:** Use the eval-match fallback (strategy 2) since bundling an opening book is extra scope. A future ticket can add a real opening book.

**Opening phase definition:** ply ≤ 20 (i.e. first 10 full moves). This is generous; chess.com uses a similar heuristic.

### 2.4 Great Move Detection

"Great" (`‼` or `!`) is awarded to the engine's best move when it has contextual significance. From the Chess Review Engine:

- **After your own brilliant move:** Your next top-engine move = Great (continuation of a brilliant sequence).
- **After opponent's error (inaccuracy/mistake/blunder):** Your top-engine move that punishes the error = Great.
- **Not in the opening phase:** Great is only awarded outside the opening (ply > 20).

This requires tracking the previous move's classification (both yours and the opponent's). The implementation ticket should thread this state through the game loop.

---

## 3. Special Cases

### 3.1 Mate Scores

Mate scores must be converted to winning chances before computing the delta (see §1.2). Key cases:

| Situation | Handling |
|---|---|
| Best move leads to forced mate (mate > 0), played move doesn't | Large negative delta → likely blunder |
| Both moves lead to mate (same direction) | Small delta → best/good |
| Played move creates forced mate (mate < 0 for opponent) | Large positive delta → best |
| Played move loses forced mate (was mating, now just winning) | `MateLost` — classify as mistake/blunder depending on resulting eval |

**Lichess's `MateSequence` logic** (from `Advice.scala`):
- `MateCreated`: eval was cp, now mate (negative) → "Checkmate is now unavoidable" (this is good for the player delivering it)
- `MateLost`: eval was mate (positive), now cp → "Lost forced checkmate sequence" (bad)
- `MateDelayed`: was mate (positive), now mate (negative) but slower → "Not the best checkmate sequence"

These should be mapped:
- `MateCreated` → **Best** (you're delivering forced mate)
- `MateLost` → **Mistake** or **Blunder** depending on the resulting cp delta
- `MateDelayed` → **Inaccuracy** or **Good** depending on mate-distance delta

### 3.2 Forced Moves (Only-One-Legal-Move)

If there is only one legal move, the move should **never** be classified negatively (the player had no choice). Classify as **Best**.

```typescript
if (legalMoveCount === 1) return BEST;
```

This prevents false blunders in king-in-must-move situations, forced recaptures, etc.

### 3.3 Checkmate

If the played move delivers checkmate, classify as **Best** (regardless of eval — it ends the game).

### 3.4 Garbage Time (one-sided positions)

When the position is already decisively won/lost (|bestEval| > 700cp ≈ winning-chances > 0.96 or < -0.96), be more lenient:

- Reduce all negative classifications by one tier (blunder → mistake, mistake → inaccuracy, inaccuracy → good).
- OR: simply don't classify moves in garbage time (skip annotation).

**Recommended:** Skip annotation in garbage time (|bestEval| > 700cp). Display "—" or no badge. This matches chess.com's behavior of not annotating moves in already-decided positions.

---

## 4. Depth Recommendations

### 4.1 Analyze Page (full analysis)

| Setting | Value | Rationale |
|---|---|---|
| Depth | 15–20 | Good balance of accuracy and speed for browser WASM. At depth 15, eval is reliable enough for classification. |
| MultiPV | 1 | Single best line is sufficient for classification. MultiPV=2 only needed for brilliant heuristic (ticket #10). |
| Movetime | 1000ms per position | Cap ensures progress on long games. |

At depth 15, the eval is within ~50cp of depth-30 eval for most positions, which is well within the inaccuracy threshold (100cp). Deeper analysis (depth 20+) is possible but significantly slower in WASM.

### 4.2 Weak-Spot Analysis (low depth, all games)

| Setting | Value | Rationale |
|---|---|---|
| Depth | 8–10 | Fast enough to process 50+ games. At depth 8, eval is within ~100-150cp of depth-30, which may cause borderline classifications to shift (inaccuracy↔mistake). Acceptable for aggregate statistics. |
| MultiPV | 1 | No need for multi-line. |
| Movetime | 200ms per position | Keeps total time manageable (50 games × 40 moves × 0.2s = ~7 min). |

**Caveat:** Low-depth analysis will misclassify some moves. Specifically:
- True blunders may be missed if the refutation is deep (depth 8 doesn't see the tactical point).
- Some moves may appear as blunders at depth 8 but not at depth 15 (false positives in sharp positions).
- Aggregate statistics (blunder rate per opening, accuracy per phase) are still meaningful at low depth — the noise averages out across many games.
- Individual game annotations should use the analyze page's deeper analysis, not the weak-spot page's low-depth eval.

### 4.3 Accuracy Calculation

Use lichess's accuracy formula (from [`AccuracyPercent.scala`](https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala)):

```typescript
// before, after: WinPercent (0-100 scale)
function accuracyFromWinPercents(before: number, after: number): number {
  if (after >= before) return 100;
  const winDiff = before - after;
  const raw = 103.1668100711649 * Math.exp(-0.04354415386753951 * winDiff) - 3.166924740191411;
  return Math.min(100, Math.max(0, raw + 1)); // +1 uncertainty bonus
}
```

For per-game accuracy, lichess uses a volatility-weighted mean combined with harmonic mean. For v1, a simple mean of per-move accuracies is acceptable. The full weighted approach can be a later enhancement.

---

## 5. Classification Decision Tree (complete)

```
Input: evalBefore, evalAfter (from player's POV), bestEval, playedMove, legalMoveCount, ply, isOpening, prevClassifications

1. If playedMove delivers checkmate → BEST
2. If legalMoveCount === 1 → BEST
3. If |bestEval| > 700cp (garbage time) → NO_ANNOTATION (skip)
4. Convert evalBefore, evalAfter to winning chances; compute delta = povDiff(color, before, after)
5. Handle mate sequences (§3.1):
   - MateCreated (cp→mate-for-us) → BEST
   - MateLost (mate-for-us→cp) → use delta from the resulting cp
   - MateDelayed → INACCURACY if mate distance increased by > 2, else GOOD
6. If delta <= -0.30 → BLUNDER
7. If delta <= -0.20 → MISTAKE
8. If delta <= -0.10 → INACCURACY
9. // Positive classifications (delta > -0.10, i.e. win-prob loss < ~10%)
10. If isOpening && winLossPct <= 2.0 && evalDiffCp <= 20 → BOOK
11. If isBestMove:
    - If not isOpening && (prevOwn === BRILLIANT || prevOpp in [INACCURACY, MISTAKE, BLUNDER]) → GREAT
    - Else → BEST
12. If winLossPct <= 2.5 → BEST
13. If winLossPct <= 8.0 → GOOD
14. // Fallback: between good and inaccuracy
15. → INACCURACY  (win-loss > 8% but winning-chance delta > -0.10)
```

---

## 6. Summary Table

| # | Classification | Glyph | Metric | Threshold | Source |
|---|---|---|---|---|---|
| 1 | Book | (theory) | Opening book / eval match | ply ≤ 20, win-loss ≤ 2%, cp-loss ≤ 20 | Chess Review Engine |
| 2 | Best | `!` | Win-prob loss | 0–2.5% (or = engine #1) | Chess Review Engine |
| 3 | Great | `‼` | Contextual best move | #1 move + after brilliant/error | Chess Review Engine |
| 4 | Good | (none) | Win-prob loss | 2.5–8% | Chess Review Engine |
| 5 | Inaccuracy | `?!` | Winning-chance Δ | Δ ≤ -0.10 | lichess (`Advice.scala`) |
| 6 | Mistake | `?` | Winning-chance Δ | Δ ≤ -0.20 | lichess (`Advice.scala`) |
| 7 | Blunder | `??` | Winning-chance Δ | Δ ≤ -0.30 | lichess (`Advice.scala`) |

**Note:** Brilliant (‼) is NOT in this table — it's a heuristic, not eval-delta. See ticket #10.

---

## 7. Test Positions

These FENs + expected classifications are for the implementation ticket's Vitest suite. Each tests a specific path in the decision tree.

### 7.1 Forced move (only one legal move) → BEST

| FEN | Move | Expected | Notes |
|---|---|---|---|
| `8/8/8/8/8/2k5/8/2K1Q3 w - - 0 1` (simplified) | any | BEST | King must move out of check, only legal moves | 

(Implementation should construct a position with exactly one legal move, e.g. king-in-check with one escape.)

### 7.2 Blunder (winning-chance delta ≤ -0.30)

| FEN | Best | Played | Expected | Notes |
|---|---|---|---|---|
| `rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 3` | (engine best) | Qh4 (Fool's Mate pattern) | BLUNDER | Black plays a normal move allowing Qh4# — after 1.f3 e5 2.g4, black's ...Qh4 is actually not the blunder; white's g4 is. Adjust: after 1.f3 e5 2.g4, classify white's g4 as BLUNDER (allows ...Qh4#). |

**Better test:** 1.f3 e5 2.g4 — white's 2.g4 is a blunder (allows Qh4#). The eval before g4 is ~0cp, after g4 it's mate-in-1 for black → winning-chance delta ≈ -1.0 → BLUNDER.

### 7.3 Mistake (winning-chance delta -0.20 to -0.30)

| FEN | Best | Played | Expected | Notes |
|---|---|---|---|---|
| (construct: a position where the played move loses ~200-300cp) | | | MISTAKE | Implementation should generate a position where best eval ≈ +100cp and played eval ≈ -150cp → delta ≈ -0.25 |

### 7.4 Inaccuracy (winning-chance delta -0.10 to -0.20)

| FEN | Best | Played | Expected | Notes |
|---|---|---|---|---|
| (construct: a position where the played move loses ~100-150cp) | | | INACCURACY | Implementation should generate a position where best ≈ +50cp and played ≈ -60cp → delta ≈ -0.12 |

### 7.5 Best move (= engine #1)

| FEN | Played | Expected | Notes |
|---|---|---|---|
| `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1` | e4 (or any top engine move) | BEST | Opening move that's the engine's #1 |

### 7.6 Book (opening theory, eval-match)

| FEN | Ply | Played | Expected | Notes |
|---|---|---|---|---|
| After 1.e4 e5 2.Nf3 (ply 3) | 3 | Nc6 | BOOK | Standard opening, eval loss ≤ 20cp |

### 7.7 Good (win-prob loss 2.5–8%)

| FEN | Best | Played | Expected | Notes |
|---|---|---|---|---|
| (construct: best ≈ +100cp, played ≈ +50cp, win-prob loss ~4%) | | | GOOD | |

### 7.8 Garbage time (no annotation)

| FEN | Best eval | Expected | Notes |
|---|---|---|---|
| Position with +800cp advantage | +800cp | NO_ANNOTATION | |bestEval| > 700cp → skip |

### 7.9 Checkmate → BEST

| FEN | Played | Expected | Notes |
|---|---|---|---|
| `rnb1kbnr/pppp1ppp/8/4p3/6PQ/8/PPPPPP2/RNB1KBNR b KQkq - 0 3` (Qh5# position) | (the mating move) | BEST | Move delivers checkmate |

---

## 8. Implementation Notes

1. **Eval clamping:** Always clamp cp to [-1000, 1000] before computing winning chances. This prevents the sigmoid from saturating and ensures deltas are meaningful.

2. **Mate handling:** Convert mate scores to winning chances using the formula in §1.2 before computing deltas. Never compare raw mate scores directly.

3. **Color perspective:** All evals must be converted to the moving player's perspective before computing deltas. `povChances(color, ev)` handles this.

4. **MultiPV:** For the 6 eval-delta classifications, only the best line (MultiPV=1) is needed. MultiPV=2 is only needed for the brilliant heuristic (ticket #10) to check if the played move is the only good move.

5. **Opening phase:** Use ply ≤ 20 for the book/theory check. This is generous but matches common practice.

6. **Previous classification state:** The "Great" classification requires tracking the previous move's classification for both the player and the opponent. Thread this through the game loop.

7. **Centipawn vs winning-chance:** The thresholds in §2.1 use winning-chance delta (lichess). The thresholds in §2.2 use win-probability loss (Chess Review Engine). These are related but not identical. The implementation should compute both and use the appropriate one per classification:
   - Negative tiers (inaccuracy/mistake/blunder): use winning-chance delta (§2.1)
   - Positive tiers (best/great/good): use win-probability loss (§2.2)
   - The boundary between "good" and "inaccuracy" is where both metrics agree: win-prob loss ~10% ≈ winning-chance delta ~-0.10. In practice, compute the winning-chance delta first (step 6-8), and only if it's > -0.10, compute the win-prob loss for the positive tiers (step 10-14).

---

## 9. Source Citations

| Source | URL | What it provides |
|---|---|---|
| lichess `Advice.scala` (CpAdvice) | https://github.com/lichess-org/lila/blob/master/modules/tree/src/main/Advice.scala | Winning-chance delta thresholds: -0.3/-0.2/-0.1 for blunder/mistake/inaccuracy |
| lichess `eval.scala` (WinPercent) | https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/eval.scala | Winning-chances formula: `2/(1+exp(-0.00368208*cp))-1`, cp clamped to [-1000,1000] |
| lichess `winningChances.ts` | https://github.com/lichess-org/lila/blob/master/ui/lib/src/ceval/winningChances.ts | TypeScript implementation of winningChances, mateWinningChances, povDiff |
| lichess `AccuracyPercent.scala` | https://github.com/lichess-org/lila/blob/master/modules/analyse/src/main/AccuracyPercent.scala | Accuracy formula: `103.1668*exp(-0.04354*winDiff)-3.1669+1` |
| lichess lila PR #11148 | https://github.com/lichess-org/lila/pull/11148 | Origin of the MULTIPLIER constant -0.00368208 |
| Chess Review Engine `classification.py` | https://github.com/H0NEYP0T-466/ChessReviewEngine/blob/master/backend/app/engine/classification.py | Win-probability-loss bands for best/excellent/good; great-move contextual logic; brilliant patterns |
| Chess Review Engine `config.py` | https://github.com/H0NEYP0T-466/ChessReviewEngine/blob/master/backend/app/config.py | Centipawn threshold fallback values; accuracy K-factor=120 |
| lichess `roundTraining.ts` | https://github.com/lichess-org/lila/blob/master/ui/analyse/src/view/roundTraining.ts | Accuracy display thresholds: ≥85 good, ≥70 inaccuracy, ≥55 mistake, <55 blunder |
