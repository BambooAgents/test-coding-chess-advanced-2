# Visual Review Failure Investigation

**Date:** 2026-08-21
**Trigger:** User report that "brilliant fires on the opera game" doesn't visually show, arrows and UI are still broken, and visual reviewers "faked or lied about their results."

## Executive Summary

**ROOT CAUSE: the `acceptance-reviewer` agent def had no `model:` field, so it used the default text-only model (GLM-5.2). It literally could not see the screenshots it captured.** This is a configuration bug, not a vague "harness bug" — one missing line in the agent definition.

The acceptance reviewers did not lie. They captured screenshots, tried to `read` them, got `[Current model does not support images. The image will be omitted from this request.]`, and then fell back to verifying via DOM text (`innerText`). This let a critical visual bug — the Brilliant badge rendering with `color: transparent` — pass as FIXED because the text `!!` was present in the DOM even though it was invisible.

**The fix:** pin `model: tng/Qwen/Qwen3.5-397B-A17B-FP8` (vision-capable) in `acceptance-reviewer.md`, matching the existing `visual-reviewer` agent. **Verified:** the acceptance-reviewer with the new model successfully reads screenshots and describes real visual details (eval bar fill level, badge glyphs, board state).

**How to add vision capabilities to any agent:** add `model: tng/Qwen/Qwen3.5-397B-A17B-FP8` to the agent's frontmatter. The default model is text-only and cannot read images. This single line is the difference between a reviewer that can catch transparent/invisible elements and one that cannot.

---

## 1. What the reviewers actually did vs. claimed

### The final reviewer (session b4a41d88) — B2/B3 "Brilliant fires on Opera Game"

**What it claimed** (`final-review.md`):
> "10.Nxb5 !! (Brilliant) fired — this is the genuinely brilliant queen sacrifice in the Opera Game. A faked engine could not produce this correct annotation."

**What it actually did:**
1. Ran a Playwright script (`analyze_verify.mjs`) that loaded the Opera Game PGN
2. Waited 10.3s for analysis to complete
3. Read `page.locator('body').innerText()` — the raw text content of the page
4. Found `10. Nxb5 !!` in the text body
5. Concluded the Brilliant badge "fired"

**The gap:** `innerText()` returns the text content of DOM elements. The `!!` text WAS present in a `<span class="sc-AjlSJ etReKy">!!</span>`. But the CSS `color` for that span was `rgba(0, 0, 0, 0)` — **transparent**. The text exists in the DOM (so `innerText` finds it) but is **invisible to the user**. The reviewer verified the data model, not the visual rendering.

**Evidence** (from the DOM audit I ran):
```json
{
  "tag": "SPAN",
  "class": "sc-AjlSJ etReKy",
  "text": "!!",
  "color": "rgba(0, 0, 0, 0)",   // ← TRANSPARENT
  "bg": "rgba(0, 0, 0, 0)",
  "fontWeight": "600",
  "fontSize": "12px"
}
```

**Root cause** (`src/pages/AnalyzePage.tsx:198-206`):
```typescript
function badgeColor(kind: string): string {
  switch (kind) {
    case 'best': return '#16a34a'
    case 'great': return '#0ea5e9'
    case 'good': return '#84cc16'
    case 'book': return '#a3a3a3'
    case 'inaccuracy': return '#eab308'
    case 'mistake': return '#f97316'
    case 'blunder': return '#dc2626'
    default: return 'transparent'   // ← 'brilliant' falls here
  }
}
```

The `MoveClassification` type includes `'brilliant'` (with glyph `'!!'`), but `badgeColor()` has **no `case 'brilliant'`**. So the badge text renders with `color: transparent`. The glyph is in the DOM but invisible.

### The play reviewer (session 4c75b44f) — "ACCEPTED"

**What it did:** This reviewer was the most rigorous. It ran 5 separate Playwright test specs, verified engine replies, takeback logic, side-switching, analyze-handoff routing, and strength configuration. It captured screenshots.

**The gap:** At line 33, it explicitly tried to view screenshots:
```
Read image file [image/png]
[Current model does not support images. The image will be omitted from this request.]
```
It said "Engine replies. Let me view the screenshots to confirm visually." → **could not view them** → proceeded to ACCEPTED anyway, based on DOM/Playwright assertions alone.

This reviewer's conclusion (Play page ACCEPTED) is likely **correct** — the Play page's core flows (engine reply, move highlights, takeback, handoff) are functional and the DOM checks are sufficient for those. But it could not verify visual polish.

### Other reviewers (puzzles, analyze, weaknesses)

The puzzles and weaknesses reviewers did Playwright work but there's no evidence they attempted to read images at all. They verified via `innerText` and source-code inspection. For puzzles (B1 — real lichess data, B5 — solution display), this was sufficient because those bugs were about data presence, not visual rendering. For analyze (B2/B3 — MultiPV, checkmate hang), the text-based verification caught the functional fix but missed the visual presentation bug.

---

## 2. Why Playwright alone is the wrong approach for visual review

Playwright is excellent for **functional** verification (does the app do the right thing?) but insufficient for **visual** verification (does the app look right to the user?). The gap:

| Layer | What Playwright checks | What it misses |
|-------|----------------------|----------------|
| DOM text | `innerText()` finds `!!` | Text is `color: transparent` (invisible) |
| Element presence | `locator().count() > 0` | Element is positioned off-screen or behind another |
| Layout | Bounding rects via `evaluate()` | Requires explicit checks; not done by default |
| Visual appearance | **Cannot check** — no image understanding | Colors, contrast, overlap, clipping, alignment |

The reviewers' Playwright scripts checked text and element presence. They did NOT check:
- Computed styles (`color`, `backgroundColor`, `visibility`, `opacity`)
- Bounding box positions relative to viewport
- Whether rendered text is actually visible to a human
- Overlapping elements
- Clipped/overflow content

### The fix: visual review needs a model that can SEE

The `acceptance-reviewer` agent uses a text-only model (GLM-5.2). It cannot read images. The harness has access to a **Qwen visual reviewer** that CAN read images, but it was not used for the acceptance gate. The AGENTS.md says "For meaningful UI work use Playwright plus the read-only Qwen visual reviewer" — but the acceptance loop only used Playwright, never Qwen.

**Corrected process:** Visual review must use a vision-capable model that actually reads the screenshots. Text/DOM checks can catch functional bugs but cannot catch visual presentation bugs like the transparent badge.

---

## 3. The actual visual bugs found

### BUG-V1: Brilliant badge is invisible (CRITICAL)
- **Where:** `src/pages/AnalyzePage.tsx:198-206`, `badgeColor()` function
- **What:** `badgeColor()` has no `case 'brilliant'` → falls to `default: return 'transparent'`
- **Impact:** The `!!` brilliant glyph renders in the DOM but with transparent color — invisible to the user. This is the exact bug the user reported.
- **Fix:** Add `case 'brilliant': return '#a855f7'` (purple, per chess.com convention) or another visible color.

### BUG-V2: No auto-advance after analysis completes (MAJOR)
- **Where:** `src/pages/AnalyzePage.tsx:274`, `setCurrentPly(0)` on PGN load; `bestMoveArrow` (line 351) and `currentEval` (line 329) both return empty/null when `currentPly === 0`
- **What:** After loading a PGN and running analysis, the board stays at the starting position. No best-move arrow, no eval bar fill, no eval label. The user must manually scrub forward to see anything visual.
- **Impact:** The analyze page looks broken/empty after analysis completes. The eval bar is blank, no arrow. The user sees a static starting position.
- **Fix:** Auto-advance `currentPly` to 1 (or the first classified move) after analysis completes, so the eval bar, arrow, and badges are immediately visible.

### BUG-V3: Eval bar shows no fill/label at ply 0 (consequence of V2)
- The EvalBar component works correctly, but receives `null` evalScore at ply 0, so it renders empty.

---

## 4. How to prevent this in future

### Process fix: Vision-capable review is mandatory for UI

The acceptance gate must include a **vision-capable reviewer** (Qwen) that actually reads screenshots, not just a text-model reviewer running Playwright. The current process let a text-only model claim "Brilliant badge fired" by reading `innerText` — it could not see that the badge was transparent.

**Updated acceptance process** (`docs/agents/acceptance.md`):
1. Code review (text model) — checks code quality, spec compliance
2. **Visual review (vision model — Qwen) — ACTUALLY READS SCREENSHOTS** ← this was missing
3. Acceptance review (text model + Playwright) — boots from scratch, exercises UX
4. A visual bug (invisible element, layout break) is a BLOCKER even if the DOM text is correct

### Reviewer script fix: check computed styles, not just text

The Playwright audit scripts should check not just `innerText()` but also:
- `window.getComputedStyle(el).color` — is the text actually a visible color?
- `getBoundingClientRect()` — is the element on-screen?
- `visibility` / `opacity` / `display` — is it actually rendered?

Example check that would have caught BUG-V1:
```javascript
// Verify the brilliant badge is actually visible, not just present in text
const badge = page.locator('span', { hasText: '!!' });
const color = await badge.evaluate(el => window.getComputedStyle(el).color);
if (color === 'rgba(0, 0, 0, 0)') throw new Error('Brilliant badge is transparent/invisible');
```

### Agent fix: agents must catch obvious bugs on their own

The acceptance reviewer read the `badgeColor` function source (it's in the session — line 28 shows it inspected `StockfishEngine.ts` and would have seen `badgeColor` if it looked at AnalyzePage). It did not notice the missing `brilliant` case. An agent doing source-level review should cross-check: "Does every value of the `MoveClassification` type have a corresponding case in `badgeColor`?" This is a 30-second static check that would have caught the bug.

**Rule for agents:** When verifying a fix, cross-check the full set of possible values against the handler. If a type has 9 variants and a switch has 7 cases, that's a bug — flag it.

---

## 5. Were the agents lying?

**No.** The agents were honest but methodology-limited. Evidence:
- The play reviewer explicitly tried to read images and hit the "model does not support images" wall — it didn't hide this.
- The final reviewer's Playwright output genuinely showed `10. Nxb5 !!` in the text body — its claim was accurate at the text level.
- No reviewer claimed to have seen a screenshot and described it falsely.

The failure was **methodological, not deceptive**: the agents verified the wrong layer. They checked "does the data model say brilliant?" (yes) instead of "does the user see a brilliant badge?" (no, it's transparent). This is a harder failure to catch because the agents were doing real work and producing real evidence — just evidence of the wrong thing.

---

## 6. Action items

1. **Fix BUG-V1** (transparent brilliant badge) — add `case 'brilliant'` to `badgeColor()`
2. **Fix BUG-V2** (no auto-advance) — advance `currentPly` after analysis completes
3. **Update acceptance process** — require vision-capable reviewer for any UI change
4. **Update acceptance-reviewer scripts** — check computed styles, not just `innerText`
5. **Add to HARNESS_TEST_REPORT.md** — F24: visual review blind spot (text-only model can't catch transparent/invisible elements)
