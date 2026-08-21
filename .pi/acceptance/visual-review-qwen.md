# Visual Review — Qwen Visual Reviewer

**Date:** 2026-08-21  
**Reviewer:** Visual review subagent (configured with `tng/Qwen/Qwen3.5-397B-A17B-FP8`)  
**Dev server:** http://localhost:5183/test-coding-chess-advanced-2/  

## ⚠️ Critical Meta-Finding: Model Cannot Read Images

**The model running this review session does NOT support image input.** Despite the agent configuration specifying `tng/Qwen/Qwen3.5-397B-A17B-FP8` (a vision-capable model), the actual runtime model returned:

```
Read image file [image/png]
[Current model does not support images. The image will be omitted from this request.]
```

This is the **exact same failure mode** that the previous acceptance reviewers encountered. The harness is configured to use a vision model but the runtime does not provide one. This is a harness infrastructure bug — the visual reviewer agent definition promises vision capability but the execution environment cannot deliver it.

**To work around this limitation, I performed an exhaustive DOM/CSS computed-style audit** using Playwright that inspects every visible element's actual rendered styles (color, height, background, position, visibility). This is more precise than screenshot eyeballing for identifying specific rendering issues like transparent text or zero-height fills, though it cannot detect subjective visual quality issues (e.g., "does this look good" or color harmony).

---

## Audit Methodology

For each page, I:
1. Loaded the page in headless Chromium (1280×900 viewport)
2. Inspected the DOM structure and computed CSS styles of all visible elements
3. Checked for invisible text (elements with text content but `color: rgba(0,0,0,0)`)
4. Checked for layout overflow, clipping, and overlap
5. For the Analyze page: loaded the Opera Game PGN, waited for analysis to complete, then inspected eval bar fill, board arrows, badge rendering, and move list

---

## Findings by Page

### 1. Home Page — ✅ PASS

- **Layout:** Clean, no overlaps or clipping
- **Navigation:** All nav links visible with proper colors
- **No invisible text** detected
- **Body content:** Renders correctly with page title and nav bar

### 2. Puzzles Page — ✅ PASS

- **Board:** Renders at (72, 346) with 560×560px, 19 pieces with SVG images
- **Puzzle info:** Rating, themes, move count all visible
- **No invisible text** detected
- **Layout:** Clean, no overflow

### 3. Play Page — ✅ PASS

- **Board:** Renders correctly with pieces
- **Controls:** Difficulty selector, side selector, action buttons all present
- **No invisible text** detected
- **Layout:** Clean

### 4. Weaknesses Page — ✅ PASS

- **Input fields:** Username input, game count selector, load button all present
- **No invisible text** detected
- **Layout:** Clean

### 5. Analyze Page — ⚠️ ISSUES FOUND

#### 5a. Brilliant Badge (`!!`) — ✅ VISIBLE (contrary to prior assumption)

**The `!!` Brilliant badge IS visible.** Its computed color is `rgb(168, 85, 247)` (purple), which is `#a855f7` — the chess.com convention for brilliant moves. The `badgeColor()` function in `AnalyzePage.tsx` DOES include the `brilliant` case:

```typescript
case 'brilliant': return '#a855f7' // purple — chess.com convention for brilliant
```

**This contradicts the parent session's finding** that `badgeColor` was missing the `brilliant` case and returning `transparent`. The parent session was testing against a **stale Vite HMR cache** — the dev server had a broken module cache that caused `AnalyzePage.tsx` to fail to export, rendering the page blank. After restarting the dev server, the page loads correctly with the brilliant badge visible.

**Badge audit summary:**
| Glyph | Classification | Color (RGB) | Visible? |
|-------|--------------|-------------|----------|
| `?!` | Inaccuracy | `rgb(234, 179, 8)` (yellow) | ✅ Yes |
| `?` | Mistake | `rgb(249, 115, 22)` (orange) | ✅ Yes |
| `??` | Blunder | `rgb(220, 38, 38)` (red) | ✅ Yes |
| `!!` | Brilliant | `rgb(168, 85, 247)` (purple) | ✅ Yes |
| `!!` | Great | (same as Brilliant — shared glyph) | ✅ Yes |

All badge glyphs are visible with correct colors. The Opera Game correctly shows `10. Nxb5 !!` (Brilliant) in the move list.

#### 5b. Eval Bar Fill — 🔴 BUG (VISUAL DEFECT)

**The eval bar's white fill is broken — it always renders with `height: 0px` regardless of the evaluation.**

- **Eval bar container:** 24px wide, 560px tall, `background: rgb(30, 30, 30)` (dark) — renders correctly
- **Eval label:** Shows the eval value (e.g., `-0.71`, `+1.65`) in `rgb(51, 51, 51)` — visible ✅
- **White fill (`WhiteFill` styled component):** `height: 0px`, `background: rgb(248, 248, 248)` — **BROKEN** ❌

**Root cause:** The `WhiteFill` styled component uses a dynamic `height` via styled-components v6 transient prop:
```typescript
const WhiteFill = styled.div<{ $pct: number }>`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: ${($pct) => $pct}%;
  background: #f8f8f8;
  transition: height 0.3s ease;
`
```

The dynamic `height: ${($pct) => $pct}%` is **not being applied at runtime**. The computed style shows `height: 0px` with no inline style and no CSS rule injected for the component's class (`sc-kLwfci`). Manual testing confirmed that setting `fill.style.height = '60%'` produces `335.734px` (correct), proving the container supports percentage heights — the issue is specifically that styled-components v6 is not injecting the dynamic style.

**Impact:** The eval bar appears as a flat dark rectangle. The eval label text is visible (floating at the top/bottom), but there is no visual white/black fill indicating the evaluation. Users cannot see at a glance who is winning.

**Reproduced in:** Both Vite dev server (port 5183) and production preview build (port 5184).

#### 5c. Best-Move Arrows — ✅ VISIBLE (after auto-advance)

After analysis completes, the page auto-advances to ply 1 (`setCurrentPly(1)`). At ply 1, the best-move arrow IS rendered:
- SVG overlay with `data-testid="board-arrows"` present
- 2 SVG children (line + arrowhead marker)
- Arrow shows the last-played move direction
- Opacity 0.8, indigo color (`#4f46e5`)

After scrubbing to ply 10, arrows continue to render correctly.

**Note:** The arrow shows the **last-played move** (not the engine's best move). The code comment on line 347 says "A true on-demand best-move arrow would require an engine call per scrub; deferred to a refinement." This is by design, not a bug.

#### 5d. Move List — ✅ VISIBLE (with scroll)

- All 33 moves render with SAN notation and classification badges
- Move list is in a scroll container (`scrollHeight: 825, clientHeight: 358`)
- 12 of 33 badges are below the fold initially, accessible via scrolling
- The Brilliant `!!` badge for move 10 (Nxb5) is at `y=824` — within the 900px viewport ✅
- Body height is 931px (31px taller than viewport) — minor, requires slight scroll

#### 5e. Accuracy Display — ✅ VISIBLE

- White accuracy: 35.4% — visible
- Black accuracy: 32.3% — visible

#### 5f. Analysis Completion — ✅ WORKS

- Analysis completes in ~10-12 seconds for the 17-move Opera Game
- No hang on the checkmate position (17.Rd8#)
- "Analyzing" text disappears after completion
- Progress indicator shows "1/33" → analysis done

---

## Summary of Visual Issues

| # | Severity | Page | Issue | Status |
|---|----------|------|-------|--------|
| 1 | 🔴 BUG | Analyze | Eval bar fill always 0px (styled-components v6 dynamic height not applied) | NOT FIXED |
| 2 | 🟡 MINOR | Analyze | Page 31px taller than viewport (minor scroll needed) | Acceptable |
| 3 | ✅ OK | Analyze | Brilliant `!!` badge IS visible (purple #a855f7) | Working correctly |
| 4 | ✅ OK | Analyze | Best-move arrows render after analysis | Working correctly |
| 5 | ✅ OK | All | No invisible text on any page | Working correctly |
| 6 | ✅ OK | All | No layout overlaps or clipping | Working correctly |

---

## Meta-Finding: Why Previous Reviewers Missed These Issues

### The "Blind Reviewer" Problem

**All acceptance reviewers (including this one) cannot read images.** The harness configures a vision-capable model (`tng/Qwen/Qwen3.5-397B-A17B-FP8`) for visual review, but the runtime model does not support image input. Every reviewer that attempted to read screenshots received:

```
[Current model does not support images. The image will be omitted from this request.]
```

### What Reviewers Actually Did vs. What They Claimed

1. **Play reviewer (4c75b44f):** Ran thorough Playwright tests (engine replies, takeback, handoff). Tried to view screenshots → got "model does not support images" → proceeded anyway. Claims were accurate because it verified via DOM assertions, not visual inspection.

2. **Final reviewer (b4a41d88):** Ran Playwright, checked `innerText` for badges. Found `!!` in text → claimed "Brilliant badge fires." This was TRUE in the DOM but the reviewer could NOT verify it was visually rendered. In this case, the badge IS visible (purple), so the claim happened to be correct.

3. **run-checks.mjs script:** Ran for 24,176 seconds (6.7 hours!) and found `completed: false, badgesFound: []`. But the final reviewer's separate run found the analysis completed in 10.3s with badges. The discrepancy was due to the stale dev server HMR cache — the `run-checks.mjs` script was hitting a broken page.

### The Real Gap

The reviewers verified **data model correctness** (does the DOM contain the right text/values) but could NOT verify **visual presentation** (does the user actually see the badge, is the eval bar filled, are arrows visible). The eval bar fill bug (#1 above) was invisible to all reviewers because:
- The eval label text (`+1.65`) was present in `innerText` → reviewer says "eval is shown"
- But the visual fill (the actual bar that shows who's winning) was 0px → user sees empty bar
- No reviewer checked the **computed height** of the fill element

### Recommended Fix for the Review Process

1. **DOM/CSS computed-style audits** (like this one) should be part of the acceptance process — not just `innerText` checks
2. **If no vision model is available**, explicitly state this and use computed-style inspection as a fallback
3. **Check styled-components dynamic styles** specifically — the eval bar fill bug is a styled-components v6 issue that wouldn't be caught by text-based testing
4. **Restart dev servers** before testing to avoid stale HMR cache issues
