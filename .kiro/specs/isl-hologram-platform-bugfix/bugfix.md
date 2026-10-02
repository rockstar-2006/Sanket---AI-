# Bugfix Requirements Document

## Introduction

This document covers the production-grade audit and fix for the Next.js 15 ISL (Indian Sign Language) hologram platform at `d:\Matri`. The platform has two test pages: `/test-speech-to-sign` (text/speech → Gemini Flash → ISL grammar → 3D holographic skeleton animation) and `/test-kalidokit` (parquet dataset workbench for VRM avatar + holographic skeleton).

Deep code inspection confirmed 7 actionable bugs across 4 files, plus 4 production improvement requirements. The bugs collectively prevent multi-word sentences from playing completely, cause the left hand to disappear mid-sign, expose an API key via a public env var, and double-render every frame in the kalidokit workbench. One reported issue (Bug 7 — compound word lookup) was verified correct by code inspection and requires no change.

---

## Bug Analysis

### Current Behavior (Defect)

**BUG 1 — CRITICAL: Stale closure on `playbackSpeed` in `startPlayingFrames`**

1.1 WHEN the user changes the playback speed slider after beginning sentence playback THEN the system continues playing all remaining words at the original speed captured at `startPlayingFrames` creation time, ignoring the updated speed value

1.2 WHEN `playbackSpeed` state changes THEN the system recreates `startPlayingFrames` (via `useCallback`), which in turn invalidates `playAction`, which invalidates `advanceQueue`, which invalidates `advanceQueueRef.current` — causing the interval timer reference to be stale inside any in-progress word animation

**BUG 2 — CRITICAL: `advanceQueueRef` stale closure causes animation queue to stop after the first word**

2.1 WHEN a sentence with 2 or more words is submitted THEN the system plays only the first word's animation and silently stops — subsequent words never animate

2.2 WHEN `advanceQueueRef.current()` is called from inside `startPlayingFrames` after a word completes THEN the system invokes a stale closure of `advanceQueue` that holds an outdated reference to `playAction`, which in turn holds an outdated `startPlayingFrames` that holds an outdated `stopAllPlayback`, resulting in the second word's interval timer never initializing

2.3 WHEN the dependency chain `stopAllPlayback → startPlayingFrames → playAction → advanceQueue` is re-evaluated on any state change THEN the system assigns a new function to `advanceQueueRef.current` at render time, but the already-scheduled `advanceTimeoutRef` from the previous word still calls the old, captured closure

**BUG 3 — CRITICAL: Fingerspell letter animations after the first letter in a sequence are cut off**

3.1 WHEN an unknown word (e.g. "sanket") is in the animation queue and its letters S-A-N-K-E-T are queued as individual `type: 'letter'` actions THEN the system plays only the first letter "S" to completion; letters "A" through "T" are cut off mid-animation and never complete

3.2 WHEN `playAction` is called for the second letter in a fingerspell sequence THEN the system calls `stopAllPlayback()` at the top of `playAction`, which clears the running interval from the current letter — the second letter's frames are generated and `startPlayingFrames` is called, but the timing gap between `stopAllPlayback` and the next `setInterval` is zero, causing the previous letter's completion timeout (`advanceTimeoutRef`) to fire into a now-orphaned state

3.3 WHEN each fingerspell letter plays at 14 frames × 33ms ≈ 467ms but `durationMs` is set to 380ms THEN the system's advance timeout fires 120ms after the interval self-terminates at frame 14, not 120ms after `durationMs`, so the actual per-letter cadence is inconsistent and the advancing state is corrupted for sequences longer than one letter

**BUG 4 — MEDIUM: `GEMINI_API_KEY` potentially exposed in client bundle via `NEXT_PUBLIC_` fallback**

4.1 WHEN `ISLGrammarSubAgent` is constructed THEN the system reads `process.env.NEXT_PUBLIC_GEMINI_API_KEY` as a fallback, and because the `NEXT_PUBLIC_` prefix causes Next.js to inline this value into the client-side JavaScript bundle at build time, any deployment that sets `NEXT_PUBLIC_GEMINI_API_KEY` will expose the Gemini API key in the browser

4.2 WHEN `speechToSignAgent.ts` is accidentally imported by a client component in the future (the file contains no `'server-only'` guard) THEN the system will compile without error and the full `ISLGrammarSubAgent` class — including the `NEXT_PUBLIC_` key reference — will be bundled for the browser

**BUG 5 — MEDIUM: Left hand detachment threshold is 36% tighter than the right, causing left hand to disappear mid-sign**

5.1 WHEN an ISL sign requires the left hand to move across the body or extend toward the signing area THEN the system falsely detects the left hand as "detached from the forearm" and hides it, because the left wrist-to-hand-root distance threshold is `0.18` world units while the equivalent right-hand threshold is `0.28`

5.2 WHEN the left hand world-space distance from `vWristL` to `vJointsL[0]` exceeds `0.18` during a valid ISL sign THEN the system sets `handValidL = false`, clears `activeLH = null`, and renders no left hand landmarks, causing visible hand disappearance mid-animation for any sign with lateral or elevated left hand movement

**BUG 6 — MEDIUM: Every parquet frame in `/test-kalidokit` is rendered twice per animation cycle**

6.1 WHEN the RAF playback loop in Effect 6 calls `setCurrentFrameIdx(targetIdx)` THEN the system triggers a React re-render, which fires the `useEffect` at lines 871–874 that depends on `[currentFrameIdx, parquetData, sourceMode, renderParquetFrame]`, causing `renderParquetFrame` to execute a second time for the same frame index that was already processed directly in the RAF loop

6.2 WHEN `renderParquetFrame` runs twice per frame THEN the system calls `drawLandmarksOnCanvas` and `handleHolisticResults` (which drives the 3D skeleton and VRM avatar) twice per animation frame, doubling the CPU load and halving the effective achievable frame rate at a given hardware budget

**BUG 8 — LOW: The purpose and ownership of `/api/sign-frames` route is undocumented**

8.1 WHEN a developer inspects `src/app/api/sign-frames` THEN the system provides no documentation, no callers reference it in the codebase, and its relationship to `dataset-parquet` is unclear, creating maintenance ambiguity

---

### Expected Behavior (Correct)

**BUG 1 Fix — Playback speed always reflects current user setting**

2.1 WHEN the user changes the playback speed slider at any time during sentence playback THEN the system SHALL apply the updated speed to the very next frame rendered, without restarting or corrupting the current word animation

2.2 WHEN `startPlayingFrames` is executing a `setInterval` THEN the system SHALL read `playbackSpeed` via a stable `useRef` (`playbackSpeedRef.current`) inside the interval callback rather than from its closure, so the calculation `intervalMs = Math.round((1000 / 30) / playbackSpeedRef.current)` always uses the live value

**BUG 2 Fix — Full multi-word sentences play to completion**

2.1 WHEN a sentence with N words is submitted THEN the system SHALL animate all N words in sequence without any word being skipped or silently dropped

2.2 WHEN `startPlayingFrames` needs to advance to the next queue item THEN the system SHALL call `advanceQueueRef.current()` which SHALL always point to the latest closure of `advanceQueue` because `advanceQueueRef.current = advanceQueue` is assigned synchronously at every render

2.3 WHEN `stopAllPlayback` and `startPlayingFrames` are used inside `advanceQueue` / `playAction` THEN the system SHALL reference these functions via stable refs (`stopAllPlaybackRef.current`, `startPlayingFramesRef.current`) so that `advanceQueue`'s own `useCallback` has no dependency on `startPlayingFrames` or `stopAllPlayback`, breaking the circular dep chain

**BUG 3 Fix — All letters in a fingerspell sequence play fully without cutoff**

3.1 WHEN an unknown word is fingerspelled THEN the system SHALL play every letter animation to completion in sequence, including the first, middle, and last letters

3.2 WHEN `playAction` is invoked for a `type: 'letter'` action that immediately follows another `type: 'letter'` action THEN the system SHALL NOT call `stopAllPlayback()` at the top of `playAction` — or SHALL call a lightweight timer-only clear that does not interrupt an already-completed prior letter — so that the per-letter advance flow remains uninterrupted

3.3 WHEN a fingerspell letter's `setInterval` self-terminates at the final frame THEN the system SHALL schedule `advanceQueueRef.current()` with a consistent 120ms post-completion delay regardless of the letter's `durationMs` metadata, and this SHALL be sufficient time for the skeleton to display the final hand shape before transitioning

**BUG 4 Fix — Gemini API key is server-side only, never in client bundle**

4.1 WHEN `ISLGrammarSubAgent` is constructed in any environment THEN the system SHALL only read `process.env.GEMINI_API_KEY` (no `NEXT_PUBLIC_` prefix), ensuring Next.js never inlines the key into client-side bundles

4.2 WHEN any module attempts to import `speechToSignAgent.ts` from a client component THEN the system SHALL throw a build-time error because the file SHALL include `import 'server-only'` as its first import statement

**BUG 5 Fix — Left hand remains visible throughout all ISL signs**

5.1 WHEN the left hand moves across the body or to the signing area during any ISL sign in the 262-word dataset THEN the system SHALL keep the left hand visible as long as `wristDistL ≤ 0.28`, matching the right-hand tolerance

5.2 WHEN the left wrist-to-hand-root distance in world space is evaluated THEN the system SHALL use threshold `0.28` (changed from `0.18`) in `holographic3DSkeleton.ts` line 715

**BUG 6 Fix — Each parquet frame is processed exactly once**

6.1 WHEN the RAF playback loop advances to a new frame index THEN the system SHALL call `renderParquetFrame` exactly once per frame — directly inside the RAF loop — with no secondary reactive `useEffect` duplicating the call

6.2 WHEN `currentFrameIdx` state changes THEN the system SHALL NOT trigger a redundant `renderParquetFrame` call; the `useEffect` at lines 871–874 SHALL be removed, and the RAF loop SHALL be the single source of truth for frame rendering during playback

6.3 WHEN the user manually scrubs to a specific frame using the scrubber or step buttons THEN the system SHALL call `renderParquetFrame` once directly in the scrubber handler, maintaining manual control without relying on the removed reactive effect

**BUG 8 Fix — `/api/sign-frames` is documented or removed**

8.1 WHEN a developer reviews `src/app/api/sign-frames` THEN the system SHALL either contain a clear README or header comment describing its purpose and callers, or the route SHALL be removed if it is dead code

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a single known word (e.g. "hello") is submitted THEN the system SHALL CONTINUE TO fetch parquet frames and animate the holographic skeleton exactly as before

3.2 WHEN a sentence contains only dataset words (no unknown words) THEN the system SHALL CONTINUE TO animate all words in sequence with smooth motion bridging between words

3.3 WHEN the user changes playback speed to 0.5×, 0.75×, or 1.0× before submitting a sentence THEN the system SHALL CONTINUE TO play the animation at the selected speed from the very first word

3.4 WHEN the `/api/agents/speech-to-sign` API route is called THEN the system SHALL CONTINUE TO use only server-side environment variables and SHALL CONTINUE TO function identically whether `NEXT_PUBLIC_GEMINI_API_KEY` is set in `.env.local` or not

3.5 WHEN the right hand performs a sign that moves away from the body THEN the system SHALL CONTINUE TO use threshold `0.28` for right hand detachment detection — this value SHALL NOT change

3.6 WHEN the user manually scrubs the parquet frame slider in `/test-kalidokit` THEN the system SHALL CONTINUE TO render the selected frame in real time in both the canvas overlay and the 3D skeleton viewport

3.7 WHEN autoPlay is enabled and a new dataset word is selected in `/test-kalidokit` THEN the system SHALL CONTINUE TO start playback from frame 0 automatically

3.8 WHEN `/test-kalidokit` is in MOV (live video) mode THEN the system SHALL CONTINUE TO process MediaPipe Holistic results and drive the VRM avatar and 3D skeleton via the existing RAF loop — the dual-render fix SHALL NOT affect MOV mode behavior

3.9 WHEN Gemini Flash is unavailable or returns an error THEN the system SHALL CONTINUE TO fall back to the rule-based ISL grammar engine and complete the animation pipeline without crashing

3.10 WHEN the animation queue reaches the end of all queued words THEN the system SHALL CONTINUE TO glide the skeleton back to neutral standby pose after an 800ms hold, or loop if looping is enabled

---

## Bug Condition Analysis

### BUG 1 & 2 — Combined Stale Closure / Dep Cycle

```pascal
FUNCTION isBugCondition_ClosureStaleness(X)
  INPUT: X of type AnimationSessionEvent
  OUTPUT: boolean
  
  RETURN (X.speedChangedAfterPlaybackStart = TRUE)
      OR (X.queueLength > 1)
END FUNCTION

// Property: Fix Checking — Speed & Queue Stability
FOR ALL X WHERE isBugCondition_ClosureStaleness(X) DO
  result ← runAnimationQueue'(X)
  ASSERT result.allWordsPlayed = TRUE
  ASSERT result.speedApplied = X.currentSpeed
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_ClosureStaleness(X) DO
  ASSERT F(X) = F'(X)  // Single-word playback at fixed speed is unchanged
END FOR
```

### BUG 3 — Fingerspell Letter Cutoff

```pascal
FUNCTION isBugCondition_LetterCutoff(X)
  INPUT: X of type FingerspellSequence
  OUTPUT: boolean
  
  RETURN X.letterCount > 1
END FUNCTION

// Property: Fix Checking — All Letters Play
FOR ALL X WHERE isBugCondition_LetterCutoff(X) DO
  result ← playFingerspellSequence'(X)
  ASSERT result.lettersPlayed = X.letterCount
  ASSERT result.eachLetterFullyRendered = TRUE
END FOR
```

### BUG 4 — API Key Exposure

```pascal
FUNCTION isBugCondition_KeyExposure(X)
  INPUT: X of type BuildArtifact
  OUTPUT: boolean
  
  RETURN X.containsNEXT_PUBLIC_GEMINI_API_KEY = TRUE
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_KeyExposure(X) DO
  bundle ← buildClientBundle'(X)
  ASSERT bundle.containsGeminiKeyValue = FALSE
END FOR
```

### BUG 5 — Left Hand Threshold Asymmetry

```pascal
FUNCTION isBugCondition_LeftHandThreshold(X)
  INPUT: X of type FrameLandmarks
  OUTPUT: boolean
  
  RETURN distance(X.leftHandRoot, X.leftWrist) > 0.18
      AND distance(X.leftHandRoot, X.leftWrist) <= 0.28
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_LeftHandThreshold(X) DO
  rendered ← renderFrame'(X)
  ASSERT rendered.leftHandVisible = TRUE
END FOR
```

### BUG 6 — Double Render

```pascal
FUNCTION isBugCondition_DoubleRender(X)
  INPUT: X of type ParquetPlaybackFrame
  OUTPUT: boolean
  
  RETURN X.isPlaying = TRUE AND X.sourceMode = 'parquet'
END FUNCTION

// Property: Fix Checking
FOR ALL X WHERE isBugCondition_DoubleRender(X) DO
  result ← processFrame'(X)
  ASSERT result.renderCallCount = 1
END FOR

// Property: Preservation Checking — Manual scrub still renders
FOR ALL X WHERE X.isPlaying = FALSE AND X.sourceMode = 'parquet' DO
  result ← scrubToFrame'(X)
  ASSERT result.renderCallCount = 1
END FOR
```

---

## Production Improvements (Concurrent with Bugfixes)

The following improvements SHALL be implemented alongside the bug fixes:

**IMPROVEMENT A — Parallel pipeline execution**

A.1 WHEN `SpeechToSignOrchestrator.processInput()` is called THEN the system SHALL run compound phrase pre-processing and Gemini grammar parsing concurrently where the compound map check has already been applied to the input text before the parallel step, using `Promise.all` or equivalent

**IMPROVEMENT B — Seamless Gemini failure fallback with proper logging**

B.1 WHEN Gemini Flash returns a non-OK HTTP status or throws a network error THEN the system SHALL silently fall back to the rule-based ISL grammar engine and SHALL log the failure to `console.warn` with the HTTP status and error message for diagnostics — the user SHALL see no error state and animation SHALL proceed normally

B.2 WHEN Gemini returns a malformed JSON response that fails to parse THEN the system SHALL catch the parse error and fall back to the rule-based engine, logging the raw response text for debugging

**IMPROVEMENT C — Next-word parquet prefetch pipeline**

C.1 WHEN the current word animation is playing THEN the system SHALL begin fetching the next word's parquet frames from `/api/dataset-parquet` in the background, storing the result in a prefetch cache keyed by `parquetWord`

C.2 WHEN `playAction` is called for a word that has a prefetched result in the cache THEN the system SHALL use the cached frames immediately with zero HTTP fetch latency and SHALL clear that entry from the cache after use

C.3 WHEN a prefetch fetch fails THEN the system SHALL discard the failure silently and allow the normal `playAction` fetch to proceed as a fallback — prefetch failures SHALL NOT interrupt playback

**IMPROVEMENT D — Loading skeleton/spinner in the 3D viewport**

D.1 WHEN `isLoadingFrames` is `true` THEN the system SHALL display a visible loading indicator overlaid on the 3D viewport (e.g. a spinner or pulsing label) so the user knows the system is fetching data, not frozen

D.2 WHEN `isLoadingFrames` transitions from `true` to `false` THEN the system SHALL remove the loading indicator and begin animation immediately without visible flash or layout shift
