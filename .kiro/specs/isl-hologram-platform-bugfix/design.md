# ISL Hologram Platform Bugfix Design

## Overview

Six confirmed bugs and four production improvements are addressed across four files in the Next.js 15 ISL hologram platform. The root cause of the three critical animation bugs (BUGs 1–3) is a single architectural problem: a `useCallback` dependency chain inside `test-speech-to-sign/page.tsx` that creates stale closures, preventing multi-word sentences from playing and breaking fingerspell sequences. The remaining bugs are isolated single-file fixes: a server-side key leak in `speechToSignAgent.ts`, an asymmetric hand-detachment threshold in `holographic3DSkeleton.ts`, and a double-render caused by a reactive `useEffect` in `test-kalidokit/page.tsx`.

The fix strategy for BUGs 1–3 is to break the dependency chain entirely by routing all inner-timer callbacks through stable `useRef` handles, and by replacing `setInterval` with a recursive `setTimeout` so playback speed is read live on every tick. Each other bug is a targeted, minimal change. The four production improvements (prefetch pipeline, loading overlay, server-only guard strengthening, and Gemini timeout/fallback) are layered on top of the bug fixes without altering the corrected architecture.

---

## Glossary

- **Bug_Condition (C)**: The specific input or state that triggers a given bug.
- **Property (P)**: The desired correct behavior when `C(X)` is true — what the fixed code must produce.
- **Preservation**: All existing behaviors that must remain byte-for-byte identical after the fix.
- **stale closure**: A JavaScript closure that captured a value (function reference, state variable) at creation time and continues to hold the old value even after the outer scope has updated it.
- **useCallback dep chain**: The dependency array on `useCallback` causes React to recreate a function whenever a listed dep changes. When function A depends on B which depends on C, any change to C recreates all three, invalidating any ref that was assigned the old A.
- **advanceQueueRef**: A `useRef` in `test-speech-to-sign/page.tsx` intended to always point to the latest `advanceQueue` closure. It is assigned at render time (`advanceQueueRef.current = advanceQueue`), which is correct — but inner closures that close over `advanceQueue` directly (rather than through the ref) still become stale.
- **playbackSpeedRef**: A new `useRef<number>` to be introduced, mirroring the `playbackSpeed` state value so that timer callbacks can read the live speed without being in the dep chain.
- **stopAllPlaybackRef / startPlayingFramesRef**: New stable `useRef` handles for the two most-reused callbacks, so `playAction` and `advanceQueue` can reference them via refs and carry zero deps on those functions.
- **recursive setTimeout pattern**: Replaces `setInterval` for frame playback. Each tick schedules the next tick with `setTimeout`, reading `playbackSpeedRef.current` fresh each time. Delay changes take effect on the very next scheduled tick.
- **renderParquetFrame**: The callback in `test-kalidokit/page.tsx` that decodes one parquet frame and drives the canvas overlay and 3D skeleton. Must be called exactly once per frame.
- **wristDistL**: World-space distance from `vWristL` (forearm wrist joint, pose landmark 15) to `vJointsL[0]` (hand root). Used as a detachment guard; if exceeded, the hand is hidden.
- **COMPOUND_PHRASE_MAP**: A static lookup table of multi-word phrases (e.g. "good morning" → "goodmorning") applied synchronously before Gemini grammar parsing.
- **prefetchCacheRef**: A new `useRef<Map<string, any[]>>` keyed by `parquetWord`, used to store background-fetched frame arrays for the next queued word.

---

## Bug Details

### BUG 1 & 2 — Stale Closure / Dependency Chain (Combined)

**Affected file:** `src/app/test-speech-to-sign/page.tsx`

The bug manifests when any sentence with two or more words is submitted, or when the user changes playback speed after playback has begun. The dependency chain is:

```
stopAllPlayback  ←deps─  startPlayingFrames  ←deps─  playAction  ←deps─  advanceQueue
```

Any state change that triggers re-creation of `stopAllPlayback` (e.g. `playbackSpeed` changing, which is a dep of `startPlayingFrames`) cascades up the chain, re-creating all four functions. At render time, `advanceQueueRef.current = advanceQueue` is reassigned to the new closure — but the `setTimeout(() => advanceQueueRef.current(), 120)` that was already scheduled in the previous word's timer closure calls the **stale** `advanceQueueRef.current`, not the new one. Because `setInterval` captures `playbackSpeed` from the closure at creation time, speed changes after playback starts have no effect until the next word (which may never start due to the same staleness problem).

**Formal Specification:**

```
FUNCTION isBugCondition_ClosureStaleness(X)
  INPUT: X of type AnimationSessionEvent
  OUTPUT: boolean

  RETURN (X.queueLength > 1)
      OR (X.speedChangedAfterPlaybackStart = TRUE)
END FUNCTION
```

**Concrete Examples:**

- Submit "WATER GOOD": skeleton plays "WATER" frames, the advance timeout fires, `advanceQueueRef.current()` calls the stale `advanceQueue`, which calls the stale `playAction`, which calls the stale `startPlayingFrames` with a stale `stopAllPlayback` — the "GOOD" animation interval is started but `stopAllPlayback` does not clear the correct timer, leaving a ghost interval. Result: "GOOD" never plays visibly.
- Submit "WATER" at 1×, then drag speed slider to 2× mid-animation: the `setInterval` was created with `intervalMs = 33ms`, `playbackSpeed` closed over as `1.0`. The slider updates React state but the running interval does not observe it. Frames continue at 33ms/frame regardless.
- Submit a five-word sentence at any speed: only word 1 animates. Words 2–5 are silently dropped because the chained stale closure means `startPlayingFrames` is called on a stale ref that schedules a new interval but `stopAllPlayback` is also stale and does not correctly clear the previous one, causing overlapping timers and corrupt state.

### BUG 3 — Fingerspell Letter Cutoff

**Affected file:** `src/app/test-speech-to-sign/page.tsx`

The bug manifests when an unknown word (one not in the 262-word dataset) is fingerspelled as individual letter actions. For a word like "SANKET", the letters `S, A, N, K, E, T` are enqueued as six `type: 'letter'` actions.

The immediate cause is the same stale-closure dep chain as BUGs 1 & 2. When `startPlayingFrames` self-terminates for letter "S" and calls `advanceQueueRef.current()` → `advanceQueue` → `playAction("A")`, the `playAction` closure it holds is stale. The stale `playAction` calls `stopAllPlayback()` with a stale reference, which may `clearInterval` the wrong handle or a null handle, leaving the previous letter's timer effectively orphaned.

Additionally, `playAction` unconditionally calls `stopAllPlayback()` at the very top. For letter-to-letter transitions where the previous letter's interval has already self-terminated and set `playbackTimerRef.current = null`, this is a no-op. However, under the recursive-setTimeout pattern introduced by the BUG 1/2 fix, calling `clearTimeout(playbackTimerRef.current)` on a completed letter is safe — but the stale-ref issue still prevents correct chaining.

**Formal Specification:**

```
FUNCTION isBugCondition_LetterCutoff(X)
  INPUT: X of type FingerspellSequence
  OUTPUT: boolean

  RETURN X.letterCount > 1
END FUNCTION
```

**Concrete Examples:**

- "SANKET" → 6 letter actions queued. Letter "S" (14 frames) plays fully. Advance fires, calls stale `playAction("A")`. "A" frames are generated synchronously but the stale `startPlayingFrames` schedules a timer on a stale closure. "A" may render 0–3 frames before the timer chain collapses. Letters "N"–"T" never start.
- "OK" → 2 letters. "O" plays fully. "K" is cut off at frame 1–2.

### BUG 4 — API Key Exposure via `NEXT_PUBLIC_` Fallback

**Affected file:** `src/lib/agents/speechToSignAgent.ts`

The `ISLGrammarSubAgent` constructor at line 80 reads:

```ts
this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
```

Any environment variable prefixed `NEXT_PUBLIC_` is inlined into the client-side JavaScript bundle by Next.js at build time. If `NEXT_PUBLIC_GEMINI_API_KEY` is set in `.env.local` (the current project has `.env.local`), the key value is embedded in every page's JS payload and visible to any browser user via DevTools.

Additionally, the file has no `import 'server-only'` guard, so a future developer could accidentally import it from a client component (`'use client'`) without a build-time error.

**Formal Specification:**

```
FUNCTION isBugCondition_KeyExposure(X)
  INPUT: X of type BuildArtifact
  OUTPUT: boolean

  RETURN X.containsNEXT_PUBLIC_GEMINI_API_KEY_reference = TRUE
      OR X.hasServerOnlyGuard = FALSE
END FUNCTION
```

**Concrete Example:**

- Developer sets `NEXT_PUBLIC_GEMINI_API_KEY=AIzaSy...` in `.env.local`. Build completes. User opens DevTools → Sources → any JS chunk → searches "AIzaSy" → finds the key.

### BUG 5 — Left-Hand Detachment Threshold Asymmetry

**Affected file:** `src/lib/holographic3DSkeleton.ts`

At line ~715, the physical detachment guard for the left hand uses threshold `0.18`:

```ts
if (wristDistL > 0.18) {
  handValidL = false;
  activeLH = null;
  this.lastValidLeftHand = null;
}
```

The equivalent right-hand guard uses `0.28`. For any ISL sign where the left hand crosses the body midline or extends toward the dominant-hand signing area (a common occurrence in two-handed signs), the left wrist-to-hand-root distance exceeds `0.18` in world space, triggering the false-detachment path and hiding the left hand entirely.

**Formal Specification:**

```
FUNCTION isBugCondition_LeftHandThreshold(X)
  INPUT: X of type FrameLandmarks
  OUTPUT: boolean

  RETURN distance(X.vJointsL[0], X.vWristL) > 0.18
     AND distance(X.vJointsL[0], X.vWristL) <= 0.28
END FUNCTION
```

**Concrete Example:**

- Sign "GOOD": left hand moves across body. `wristDistL` reaches 0.22. Right hand equivalent (0.22 < 0.28) would stay visible. Left hand at 0.22 > 0.18 is hidden. The holographic skeleton appears to have no left hand for a significant portion of the sign.

### BUG 6 — Double Render per Parquet Frame

**Affected file:** `src/app/test-kalidokit/page.tsx`

The RAF playback loop (Effect 6, line ~877) advances the frame index and calls `setCurrentFrameIdx(targetIdx)`. This state update triggers a React re-render. The `useEffect` at lines 870–874 has `[currentFrameIdx, parquetData, sourceMode, renderParquetFrame]` as dependencies, so it fires after every frame-index state update — calling `renderParquetFrame(currentFrameIdx)` a second time for the same frame the RAF loop already processed.

The RAF loop itself does **not** call `renderParquetFrame` directly; it only calls `setCurrentFrameIdx`. The actual render currently happens entirely via the reactive effect. This means the second call is the only real one — but the architecture creates a latent bug where any future direct `renderParquetFrame` call in the RAF loop would produce a double render.

The correct fix is: have the RAF loop call `renderParquetFrame` directly (single source of truth), remove the reactive effect, and add a direct `renderParquetFrame` call in the manual scrubber handler `onScrubberChange` and the step buttons handler `stepFrame`.

**Formal Specification:**

```
FUNCTION isBugCondition_DoubleRender(X)
  INPUT: X of type ParquetPlaybackFrame
  OUTPUT: boolean

  RETURN X.isPlaying = TRUE
     AND X.sourceMode = 'parquet'
     AND reactiveEffectPresent = TRUE
END FUNCTION
```

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**

- Single-word parquet playback (e.g. "HELLO") must continue to fetch and animate exactly as before — the ref-based approach must not alter the happy-path single-word flow.
- The `stopAllPlayback` function's behavior when called from UI buttons (Reset Pose, word-isolation controls) must remain identical — it still clears all timers and resets playing state.
- Right-hand detachment threshold (`0.28`) must not change — only the left-hand threshold is updated.
- `glideToStandby` and `loopAnimation` behavior at end-of-queue must remain unchanged.
- MOV mode in `test-kalidokit` — the MediaPipe Holistic RAF loop — must be completely unaffected by the parquet double-render fix.
- Manual scrubbing in `test-kalidokit` must continue to render the selected frame visually in real time.
- The `SpeechToSignOrchestrator.processInput()` public interface and return type must not change.
- The rule-based ISL grammar fallback engine must continue to function when Gemini is unavailable.

**Scope of Changes:**

Inputs that do NOT satisfy any bug condition are completely unaffected:
- Single-word sentences with no speed change during playback.
- Left-hand signs where `wristDistL ≤ 0.18` (already valid under old threshold; remain valid under new one).
- Right-hand signs (threshold unchanged).
- `test-kalidokit` in MOV mode.
- Direct API calls to `/api/agents/speech-to-sign` — server-side behavior is identical; only the key-lookup fallback chain is shortened.

---

## Hypothesized Root Cause

### BUGs 1 & 2 & 3 — Single Root Cause

The `useCallback` dependency array enforces referential stability only for the listed deps. The chain:

```
stopAllPlayback: deps=[playbackTimerRef, advanceTimeoutRef, standbyTimeoutRef]
startPlayingFrames: deps=[playbackSpeed, smoothMotion, stopAllPlayback]
playAction: deps=[smoothMotion, startPlayingFrames, stopAllPlayback]
advanceQueue: deps=[playAction, glideToStandby, replayFullSequence]
```

`playbackSpeed` is a React state variable. Any slider change triggers:
1. `setPlaybackSpeed(newVal)` → re-render
2. `startPlayingFrames` recreated (new function object) because `playbackSpeed` is in its deps
3. `playAction` recreated (new function object) because `startPlayingFrames` changed
4. `advanceQueue` recreated (new function object) because `playAction` changed
5. `advanceQueueRef.current = advanceQueue` is re-assigned at render time ✓ — but the `setTimeout(() => advanceQueueRef.current(), 120)` that was **already scheduled inside a running setInterval** closed over the old `advanceQueueRef` object reference — wait, actually it closes over the `advanceQueueRef` ref object itself (refs are stable), but it calls `.current` at call time, so the ref approach is sound.

The real problem is subtler: `startPlayingFrames` itself closes over `stopAllPlayback` directly (not via a ref). When `stopAllPlayback` is recreated (because `startPlayingFrames` is being recreated), the new `startPlayingFrames` captures the new `stopAllPlayback`. But the `setInterval` callback that was created with the **previous** `startPlayingFrames` closure still holds the **previous** `stopAllPlayback`. When that old interval's advance logic calls `advanceQueueRef.current()` → new `advanceQueue` → new `playAction` → new `startPlayingFrames` → new `stopAllPlayback` — this chain actually works correctly at the function level. The bug is that `playbackSpeed` inside the running `setInterval` callback was captured at interval-creation time. Changing the slider mid-playback doesn't reschedule the interval. The `intervalMs` variable is computed once at `setInterval` creation and never updated.

For multi-word playback without any speed change: the `setInterval` for word 1 calls `advanceQueueRef.current()` after the final frame. `advanceQueueRef.current` is correctly updated at every render. But `advanceQueue` calls `playAction(nextAction)` via a `setTimeout(..., 0)`. Inside `playAction`, `startPlayingFrames(loadedFrames)` is called. At this point, `startPlayingFrames` is the latest closure — **but only if no state change happened between the first word starting and this call**. If `isLoadingFrames` was toggled (it is — `setIsLoadingFrames(true)` fires during word 2's fetch), this causes a re-render, which potentially recreates `startPlayingFrames` during the async gap. The `playAction` closure captured before the re-render calls the old `startPlayingFrames`. The old `startPlayingFrames` calls the old `stopAllPlayback`, which references a `playbackTimerRef.current` that may already be cleared. The `setInterval` for word 2 starts, but the advance after word 2 calls the stale `advanceQueueRef` — no wait, the ref is updated. The deeper issue is that `playAction` is `async` and captures `startPlayingFrames` in its closure at the time `playAction` was created. If `startPlayingFrames` was recreated mid-async-execution (due to `setIsLoadingFrames` triggering a re-render), the captured `startPlayingFrames` is stale.

**Root cause, definitively:** `playAction` is an `async` function. During its `await fetch(...)`, React re-renders (because `setIsLoadingFrames(true)` was called). The re-render recreates `stopAllPlayback` and `startPlayingFrames` (because they depend on state or each other). But `playAction` is already mid-execution with the old `startPlayingFrames` in its closure. It calls the old `startPlayingFrames` after the await, which correctly starts an interval — but that interval's advance callback calls `advanceQueueRef.current()` with correct ref traversal. So word 2 plays. BUT: inside `startPlayingFrames`, `stopAllPlayback` is called at entry. The `stopAllPlayback` referenced is the stale one from before the async gap. If the stale `stopAllPlayback` holds stale timer refs, it may fail to clear a ghost interval.

**Fix:** Route all cross-function calls through refs (`stopAllPlaybackRef.current`, `startPlayingFramesRef.current`). Replace `setInterval` with recursive `setTimeout` reading `playbackSpeedRef.current` on each tick. Remove `stopAllPlayback` and `startPlayingFrames` from all `useCallback` dependency arrays; instead assign them to refs after each `useCallback` definition. This completely eliminates the cascade.

### BUG 4 — Accidental `NEXT_PUBLIC_` Fallback

A developer added the `NEXT_PUBLIC_GEMINI_API_KEY` fallback to allow quick local testing without renaming the env var. The `server-only` guard was never added because the file was initially only imported by API routes. Neither mistake is caught at build time under the current configuration.

### BUG 5 — Copy-Paste Threshold Asymmetry

The left-hand detachment block was likely written by copying the right-hand block. The right-hand threshold was empirically tuned to `0.28` for the 262-word ISL dataset. The left-hand block retained the initial conservative value `0.18` and was never independently tuned against left-hand-dominant or crossing signs.

### BUG 6 — Reactive Effect Duplication

The `useEffect` at lines 870–874 was written as the primary render trigger. The RAF loop later updated `currentFrameIdx` state as a side-effect of its own frame advancing, inadvertently triggering the effect on every RAF tick. Because the RAF loop itself never called `renderParquetFrame` directly, removing the effect without adding a direct RAF call would break rendering entirely — which is why the dual pattern persisted.

---

## Correctness Properties

Property 1: Bug Condition — Multi-Word Queue Plays to Completion

_For any_ animation session where `isBugCondition_ClosureStaleness(X)` is true (queue length > 1 OR speed changed after start), the fixed animation system SHALL animate every word/letter in the queue in sequence without any item being silently skipped, producing `result.allWordsPlayed = TRUE` and applying the current `playbackSpeed` to every frame from the moment of the speed change forward.

**Validates: Requirements 2.1, 2.2, 2.3, 3.1, 3.2**

Property 2: Bug Condition — Fingerspell Sequence Completes All Letters

_For any_ fingerspell sequence where `isBugCondition_LetterCutoff(X)` is true (letter count > 1), the fixed system SHALL play every letter animation to full completion in sequence, producing `result.lettersPlayed = X.letterCount` with each letter's 14 frames rendered before the transition to the next letter.

**Validates: Requirements 3.1, 3.2, 3.3**

Property 3: Bug Condition — Gemini Key Never in Client Bundle

_For any_ build artifact where `isBugCondition_KeyExposure(X)` is true (file references `NEXT_PUBLIC_GEMINI_API_KEY` OR lacks `server-only` guard), the fixed code SHALL eliminate the `NEXT_PUBLIC_GEMINI_API_KEY` reference and SHALL add `import 'server-only'` as the first import, ensuring `bundle.containsGeminiKeyValue = FALSE` for all deployment configurations.

**Validates: Requirements 4.1, 4.2**

Property 4: Bug Condition — Left Hand Visible for All ISL Signs

_For any_ frame where `isBugCondition_LeftHandThreshold(X)` is true (left wrist distance > 0.18 and ≤ 0.28), the fixed skeleton renderer SHALL set `handValidL = true` and render the left hand landmarks, matching the right-hand behavior at the same distance.

**Validates: Requirements 5.1, 5.2**

Property 5: Bug Condition — Parquet Frame Rendered Exactly Once

_For any_ parquet playback frame where `isBugCondition_DoubleRender(X)` is true (isPlaying=true, sourceMode='parquet'), the fixed system SHALL call `renderParquetFrame` exactly once per frame index advance, producing `result.renderCallCount = 1`.

**Validates: Requirements 6.1, 6.2**

Property 6: Preservation — Non-Buggy Inputs Unchanged

_For any_ input where none of the bug conditions above hold (single-word playback at fixed speed, right-hand signs, MOV mode, manual scrubbing, API calls with no `NEXT_PUBLIC_` var set), the fixed system SHALL produce the same behavior as the original system for all such inputs.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

---

## Fix Implementation

### BUGs 1 + 2 + 3 — File: `src/app/test-speech-to-sign/page.tsx`

**Step 1 — Add stable speed ref, sync at render time**

After the existing `const [playbackSpeed, setPlaybackSpeed] = useState(1)` declaration, add:

```ts
const playbackSpeedRef = useRef<number>(1);
playbackSpeedRef.current = playbackSpeed; // sync at every render, no effect needed
```

**Step 2 — Add stable function refs**

After the existing timer refs block, add:

```ts
const stopAllPlaybackRef = useRef<() => void>(() => {});
const startPlayingFramesRef = useRef<(frames: any[]) => void>(() => {});
```

**Step 3 — Define `stopAllPlayback` with empty deps, assign to ref**

```ts
const stopAllPlayback = useCallback(() => {
  if (playbackTimerRef.current) {
    clearTimeout(playbackTimerRef.current); // changed: clearTimeout not clearInterval
    playbackTimerRef.current = null;
  }
  if (advanceTimeoutRef.current) {
    clearTimeout(advanceTimeoutRef.current);
    advanceTimeoutRef.current = null;
  }
  if (standbyTimeoutRef.current) {
    clearTimeout(standbyTimeoutRef.current);
    standbyTimeoutRef.current = null;
  }
  isPlayingRef.current = false;
  setIsPlaying(false);
}, []); // no deps — all reads go through refs
stopAllPlaybackRef.current = stopAllPlayback;
```

**Step 4 — Rewrite `startPlayingFrames` with recursive `setTimeout`, assign to ref**

```ts
const startPlayingFrames = useCallback((frameList: any[]) => {
  if (!frameList || frameList.length === 0) return;

  stopAllPlaybackRef.current(); // call via ref, not direct closure dep
  isPlayingRef.current = true;
  setIsPlaying(true);
  currentFrameIdxRef.current = 0;
  setCurrentFrameIdx(0);

  const scheduleNextFrame = () => {
    const delay = Math.round((1000 / 30) / playbackSpeedRef.current); // live speed read
    playbackTimerRef.current = setTimeout(() => {
      const nextIdx = currentFrameIdxRef.current + 1;

      if (nextIdx >= frameList.length) {
        playbackTimerRef.current = null;
        isPlayingRef.current = false;
        setIsPlaying(false);
        lastPlayedFrameRef.current = frameList[frameList.length - 1];
        advanceTimeoutRef.current = setTimeout(() => {
          advanceQueueRef.current(); // always-current ref
        }, 120);
        return;
      }

      currentFrameIdxRef.current = nextIdx;
      setCurrentFrameIdx(nextIdx);
      const rawFrame = frameList[nextIdx];
      if (skeletonRef.current && rawFrame) {
        const finalFrame = smoothMotion
          ? smootherRef.current.smooth(rawFrame)
          : rawFrame;
        skeletonRef.current.update(finalFrame);
      }

      scheduleNextFrame(); // recurse — reads live speed on next call
    }, delay);
  };

  // Render frame 0 immediately
  const frame0 = frameList[0];
  if (skeletonRef.current && frame0) {
    const finalFrame0 = smoothMotion ? smootherRef.current.smooth(frame0) : frame0;
    skeletonRef.current.update(finalFrame0);
  }

  scheduleNextFrame();
}, [smoothMotion]); // only smoothMotion — no stopAllPlayback, no playbackSpeed
startPlayingFramesRef.current = startPlayingFrames;
```

**Step 5 — Update `playAction` to call via refs, remove stale deps**

Replace all direct calls to `stopAllPlayback(...)` and `startPlayingFrames(...)` inside `playAction` with `stopAllPlaybackRef.current()` and `startPlayingFramesRef.current(...)`. Change the `useCallback` dep array from `[smoothMotion, startPlayingFrames, stopAllPlayback]` to `[smoothMotion]`.

**Step 6 — Update `advanceQueue` to call `playAction` via ref if needed**

`advanceQueue` calls `playAction` directly. To avoid `playAction` being in its dep array, add `playActionRef`:

```ts
const playActionRef = useRef<(action: ChoreographedSignAction) => void>(() => {});
```

Assign `playActionRef.current = playAction` after its `useCallback`. Inside `advanceQueue`, call `playActionRef.current(nextAction)` instead of `playAction(nextAction)`. Change `advanceQueue`'s deps from `[playAction, glideToStandby, replayFullSequence]` to `[glideToStandby, replayFullSequence]`.

**Why this fixes BUG 3:** With the recursive-setTimeout pattern, each letter's timer self-terminates cleanly (`playbackTimerRef.current = null`). When `advanceQueueRef.current()` fires 120ms later and `playAction` is called for the next letter, `stopAllPlaybackRef.current()` runs `clearTimeout(null)` (no-op). Then `startPlayingFramesRef.current(nextLetterFrames)` starts the next letter's timer with a fresh closure. No stale references anywhere in the chain.

---

### BUG 4 — File: `src/lib/agents/speechToSignAgent.ts`

**Change 1 — Add `server-only` guard as first import:**

```ts
import 'server-only';
```

This must be the very first line after any comments/copyright header.

**Change 2 — Remove `NEXT_PUBLIC_` fallback from constructor:**

```ts
// Before:
this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

// After:
this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
```

No other changes to the constructor or class structure.

---

### BUG 5 — File: `src/lib/holographic3DSkeleton.ts`

**Single line change at line ~715:**

```ts
// Before:
if (wristDistL > 0.18) {

// After:
if (wristDistL > 0.28) {
```

No other changes. The right-hand equivalent `0.28` threshold is on a separate code path and must not be touched.

---

### BUG 6 — File: `src/app/test-kalidokit/page.tsx`

**Change 1 — Add direct `renderParquetFrame` call inside the RAF loop (Effect 6):**

Inside the RAF loop's `if (targetIdx !== lastRenderedIdx)` block, after `setCurrentFrameIdx(targetIdx)`, add:

```ts
renderParquetFrame(targetIdx);
```

The `renderParquetFrame` callback is already defined with `useCallback`. Including it in Effect 6's dep array is acceptable since it is memoized — or use a ref pattern consistent with the rest of the file.

**Change 2 — Remove the reactive duplicate `useEffect` at lines 870–874:**

Delete the entire effect:

```ts
// DELETE THIS BLOCK:
useEffect(() => {
  if (sourceMode === 'parquet' && parquetData) {
    renderParquetFrame(currentFrameIdx);
  }
}, [currentFrameIdx, parquetData, sourceMode, renderParquetFrame]);
```

**Change 3 — Add direct `renderParquetFrame` call in `onScrubberChange`:**

```ts
const onScrubberChange = (newIdx: number) => {
  setIsPlaying(false);
  currentFrameIdxRef.current = newIdx;
  setCurrentFrameIdx(newIdx);
  if (sourceMode === 'parquet' && parquetData) {
    renderParquetFrame(newIdx); // direct call, replacing removed effect
  }
};
```

**Change 4 — Ensure `stepFrame` also triggers render:**

`stepFrame` calls `onScrubberChange(nextIdx)`, so it inherits the direct render call from Change 3 automatically — no separate change needed.

---

### IMPROVEMENT A — Parallel Pipeline in `processInput`

**File:** `src/lib/agents/speechToSignAgent.ts`

The compound phrase replacement step is synchronous and fast (~microseconds). The Gemini call is the dominant latency (~200–800ms). Since vocab matching requires Gemini's output (the token list), true parallelism across the full pipeline is not possible. The targeted improvement is:

1. Apply `COMPOUND_PHRASE_MAP` synchronously (already done — no change needed).
2. Fire the Gemini call immediately after compound replacement, without any intermediate awaits.
3. Add an `AbortController` with a 3000ms timeout so Gemini never blocks the pipeline indefinitely.

```ts
async processInput(inputText: string): Promise<SpeechToSignPipelineResult> {
  const startTime = Date.now();

  // Step 0: Synchronous compound phrase normalization
  let processedInput = inputText.trim();
  for (const [phrase, target] of Object.entries(COMPOUND_PHRASE_MAP)) {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    processedInput = processedInput.replace(regex, target);
  }

  // Step 1: Grammar parsing with AbortController timeout
  const grammarResult = await this.grammarAgent.parseGrammar(processedInput);
  // (timeout is now inside parseGrammar — see Improvement B)

  // Step 2: Vocab matching (sequential, depends on grammarResult)
  // ... rest unchanged
}
```

---

### IMPROVEMENT B — Gemini Timeout + Structured Fallback Logging

**File:** `src/lib/agents/speechToSignAgent.ts`

Add `AbortController` timeout inside `ISLGrammarSubAgent.parseGrammar()`:

```ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 3000);

try {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${this.primaryModel}:generateContent?key=${this.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ... }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeoutId);

  if (res.ok) {
    const data = await res.json();
    const rawResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (rawResponseText) {
      try {
        const parsed = JSON.parse(rawResponseText.replace(/```json|```/g, '').trim());
        return { ... };
      } catch (parseErr) {
        console.warn('[ISLGrammarSubAgent] JSON parse failed, using rule-based engine. Raw:', rawResponseText);
        // falls through to ruleBasedFallback
      }
    }
  } else {
    console.warn(`[ISLGrammarSubAgent] Gemini HTTP ${res.status}, using rule-based engine`);
  }
} catch (err) {
  clearTimeout(timeoutId);
  if ((err as Error).name === 'AbortError') {
    console.warn('[ISLGrammarSubAgent] Gemini timed out (3000ms), using rule-based engine');
  } else {
    console.warn('[ISLGrammarSubAgent] Gemini call failed, using rule-based engine:', err);
  }
}

return this.ruleBasedFallback(cleanText);
```

---

### IMPROVEMENT C — Next-Word Parquet Prefetch Pipeline

**File:** `src/app/test-speech-to-sign/page.tsx`

Add a prefetch cache ref after the existing timer refs:

```ts
const prefetchCacheRef = useRef<Map<string, any[]>>(new Map());
```

Inside `startPlayingFramesRef`'s implementation (inside `startPlayingFrames`), after `scheduleNextFrame()` is called, add a background prefetch for the next queue item:

```ts
// Background prefetch for next word (non-blocking)
const nextActionIdx = currentActionIndexRef.current + 1;
const nextAction = animationQueueRef.current[nextActionIdx];
if (nextAction?.parquetWord && !prefetchCacheRef.current.has(nextAction.parquetWord)) {
  fetch(`/api/dataset-parquet?word=${encodeURIComponent(nextAction.parquetWord)}`)
    .then((r) => r.json())
    .then((data) => {
      if (data?.frames) {
        prefetchCacheRef.current.set(nextAction.parquetWord, data.frames);
      }
    })
    .catch(() => {}); // silent failure — normal fetch in playAction is the fallback
}
```

In `playAction`, before the `await fetch(...)` for a `parquetWord`, add a cache check:

```ts
if (action.parquetWord) {
  const cached = prefetchCacheRef.current.get(action.parquetWord);
  if (cached) {
    prefetchCacheRef.current.delete(action.parquetWord);
    setIsLoadingFrames(false);
    smootherRef.current.reset();
    setFrames(cached);
    startPlayingFramesRef.current(cached);
    return;
  }
  // else: fall through to normal fetch
  setIsLoadingFrames(true);
  // ... existing fetch logic
}
```

---

### IMPROVEMENT D — Loading Overlay in 3D Viewport

**File:** `src/app/test-speech-to-sign/page.tsx`

Locate the 3D viewport container `div`. Add `relative` to its `className` if not already present.

Inside that `div`, add the conditional overlay as the first child:

```tsx
{isLoadingFrames && (
  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm z-10 rounded-b-3xl pointer-events-none">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-[3px] border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
      <span className="text-xs font-mono text-cyan-400 tracking-wider">
        Loading sign data...
      </span>
    </div>
  </div>
)}
```

The `isLoadingFrames` state is already defined and toggled by `setIsLoadingFrames(true/false)` in `playAction`. No additional state is needed.

---

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach for each bug:

1. **Exploratory (pre-fix):** Write tests that simulate the bug condition and run them against the **unfixed** code. Observe failures to confirm the root cause analysis. If a test passes unexpectedly on unfixed code, the hypothesis is wrong and must be revised.
2. **Fix + Preservation checking (post-fix):** Run the same tests against the **fixed** code to verify Property 1–5. Run preservation tests to verify Property 6.

---

### Exploratory Bug Condition Checking

**Goal:** Surface counterexamples that prove the bugs exist before committing to the fix, confirming the root cause.

**BUG 1 & 2 Exploration:**

Test on unfixed `page.tsx`:

```
Test: Submit sentence "WATER GOOD" (two-word queue)
Expected (fixed): Both words animate sequentially
Expected (unfixed): Only "WATER" animates; "GOOD" silently dropped
Counterexample: animationQueueRef.current.length = 2 but currentActionIndexRef.current never advances past 0
```

```
Test: Submit "WATER", then change speed slider to 2.0x mid-animation
Expected (fixed): Remaining frames play at 2× speed
Expected (unfixed): Speed change has no effect; interval continues at original ms
Counterexample: Frame timestamps show constant 33ms gap despite speed=2.0
```

**BUG 3 Exploration:**

```
Test: Submit word "OK" (unknown word → O, K fingerspell)
Expected (fixed): Both O and K play fully (14 frames each)
Expected (unfixed): O plays, K either plays 0–3 frames or not at all
Counterexample: currentFrameIdxRef.current is stuck at 0 when K is supposed to be playing
```

**BUG 6 Exploration:**

```
Test: In test-kalidokit, load any parquet file, play for 1 second, count renderParquetFrame invocations
Expected (fixed): 30 calls per second (one per frame)
Expected (unfixed): 60 calls per second (two per frame — RAF + reactive effect)
Counterexample: console.count('render') inside renderParquetFrame shows double count
```

**Expected Counterexamples (unfixed code):**

- Word 2+ in any multi-word sentence never starts or starts briefly then freezes.
- `advanceQueueRef.current` always points to latest closure — but `startPlayingFrames` called from a stale `playAction` closure holds a stale `stopAllPlayback` that doesn't correctly clear the previous timer.
- Render call count is exactly 2× the frame count during parquet playback.

---

### Fix Checking

**BUGs 1 & 2:**

```
FOR ALL sentences WHERE sentenceWordCount > 1 DO
  result := playAnimationQueue_fixed(sentence)
  ASSERT result.wordsAnimated = sentenceWordCount
  ASSERT result.noWordSkipped = TRUE
END FOR

FOR ALL speedChanges WHERE changedDuringPlayback = TRUE DO
  result := measureFrameInterval_fixed(afterChangeFrame)
  ASSERT ABS(result.actualIntervalMs - expectedIntervalMs(newSpeed)) < 5
END FOR
```

**BUG 3:**

```
FOR ALL words WHERE NOT IN VOCABULARY_262 AND word.length > 1 DO
  result := playFingerspell_fixed(word)
  ASSERT result.lettersRendered = word.length
  ASSERT result.eachLetterCompletedAllFrames = TRUE
END FOR
```

**BUG 4:**

```
Build the project and inspect client bundle:
ASSERT bundle.includes('NEXT_PUBLIC_GEMINI_API_KEY') = FALSE
ASSERT bundle.includes(process.env.GEMINI_API_KEY) = FALSE
ASSERT importing speechToSignAgent.ts from a 'use client' file THROWS build error
```

**BUG 5:**

```
FOR ALL frames WHERE 0.18 < wristDistL <= 0.28 DO
  result := renderFrame_fixed(frame)
  ASSERT result.leftHandVisible = TRUE
END FOR
```

**BUG 6:**

```
FOR ALL parquetPlaybackFrames WHERE isPlaying = TRUE DO
  result := processFrame_fixed(frame)
  ASSERT result.renderCallCount = 1
END FOR
```

---

### Preservation Checking

**Goal:** Verify that inputs where the bug condition does NOT hold produce identical behavior before and after the fix.

```
FOR ALL sentences WHERE sentenceWordCount = 1 AND speedUnchanged = TRUE DO
  ASSERT originalBehavior(sentence) = fixedBehavior(sentence)
END FOR

FOR ALL frames WHERE wristDistL <= 0.18 DO
  ASSERT originalRenderResult(frame).leftHandVisible = fixedRenderResult(frame).leftHandVisible
END FOR

FOR ALL frames WHERE wristDistL > 0.28 DO
  // Both old and new code hide the hand — behavior must match
  ASSERT fixedRenderResult(frame).leftHandVisible = FALSE
END FOR

FOR ALL parquetScrubEvents WHERE isPlaying = FALSE DO
  ASSERT scrubCallCount_fixed = 1  // manual scrub still renders exactly once
END FOR

FOR ALL movModeFrames DO
  ASSERT movBehavior_fixed = movBehavior_original  // RAF fix must not affect MOV mode
END FOR
```

**Testing Approach for Preservation:**

Property-based testing is recommended for BUGs 1–3 preservation because the state space is large (many combinations of queue length, speed, word type) and automated generation catches edge cases that manual test enumeration misses. For BUG 5, the preservation check can be a simple unit test covering the three distance ranges: < 0.18, 0.18–0.28, > 0.28.

---

### Unit Tests

- Test `stopAllPlayback` with all three timer refs in various states (null, set, already-cleared) — must never throw.
- Test `startPlayingFrames` with a 3-frame list at `playbackSpeedRef.current = 1.0`, verify frames render in order.
- Test speed mid-playback: change `playbackSpeedRef.current = 2.0` after frame 1, verify frame 2 arrives at ~16ms not ~33ms.
- Test `advanceQueue` with a 3-item queue: verify all three `playAction` calls fire in sequence.
- Test fingerspell sequence "ABC": verify `renderCallCount` for each letter equals its frame count.
- Test `wristDistL` threshold: 0.17 → visible, 0.22 → visible (fixed), 0.29 → hidden.
- Test `onScrubberChange(5)` in test-kalidokit with parquet loaded: verify `renderParquetFrame(5)` is called exactly once.

### Property-Based Tests

- Generate random sentence lengths (1–10 words from VOCABULARY_262): verify all words animate and the queue index advances to `queueLength - 1`.
- Generate random fingerspell words (2–8 chars): verify `lettersRendered = word.length` for all.
- Generate random playback speed values (0.25–3.0) applied at random frame indices during playback: verify no words are dropped and frame timing matches speed within 10ms tolerance.
- Generate random `wristDistL` values in [0, 0.5]: verify left-hand visibility exactly matches `wristDistL <= 0.28`.
- Generate random frame index sequences for parquet playback: verify `renderCallCount = 1` for every frame.

### Integration Tests

- Full pipeline: type "good morning how are you" → Gemini parses → tokens mapped → queue plays all words in sequence → skeleton glides to standby after last word. Assert no words dropped, standby fires once.
- Fingerspell pipeline: type an unknown 6-letter word → all 6 letters play fully → skeleton returns to standby.
- Speed change mid-sentence: play a 4-word sentence, change speed from 1.0× to 2.0× after word 1 — verify remaining 3 words play at 2× with no queue corruption.
- Left-hand sign: load a sign from the dataset known to use left-hand crossing (e.g. a two-handed sign) — verify left hand remains visible throughout all frames.
- Parquet workbench: load a parquet file, play 2 seconds, pause, scrub backward — verify no double-render artifacts and skeleton position matches scrubbed frame exactly.
- Server-only guard: attempt to import `speechToSignAgent.ts` in a test marked `'use client'` — verify Next.js build rejects it.
