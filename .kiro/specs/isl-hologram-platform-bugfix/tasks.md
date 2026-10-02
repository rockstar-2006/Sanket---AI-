# Implementation Plan

---

## Phase 1 — Exploration (Write tests BEFORE fixing anything)

- [x] 1. Write bug condition exploration tests (BEFORE any fix)
  - **Property 1: Bug Condition** - Multi-Bug Exploration Suite
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Surface counterexamples that demonstrate each bug before committing to the fix strategy
  - **Scoped PBT Approach**: Each sub-test is scoped to the concrete minimal failing case for that bug condition

  - [x] 1.1 Explore BUG 1 & 2 — Stale closure / multi-word queue dropout
    - **Property 1: Bug Condition** - Multi-Word Queue Stale Closure
    - File under test: `src/app/test-speech-to-sign/page.tsx`
    - Scope: submit sentence "WATER GOOD" (queue length = 2, no speed change) — isBugCondition_ClosureStaleness returns TRUE
    - Observe: `animationQueueRef.current.length = 2` but `currentActionIndexRef.current` never advances past 0
    - Scope 2: submit "WATER" at 1×, change speed to 2× mid-animation — isBugCondition_ClosureStaleness returns TRUE
    - Observe: frame timestamps show constant ~33ms gap despite `playbackSpeed = 2.0`
    - Run on UNFIXED code — **EXPECTED OUTCOME: FAIL** (both "GOOD" is dropped; speed change has no effect)
    - Document counterexample: e.g. "GOOD never renders; `advanceQueueRef.current` called but stale `playAction` chain collapses"
    - Mark complete when test is written, run, and failure documented
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.2 Explore BUG 3 — Fingerspell letter cutoff
    - **Property 1: Bug Condition** - Fingerspell Letter Cutoff
    - File under test: `src/app/test-speech-to-sign/page.tsx`
    - Scope: submit unknown word "OK" (2 letters → isBugCondition_LetterCutoff returns TRUE, letterCount = 2)
    - Observe: "O" plays all 14 frames; "K" renders 0–3 frames then stops
    - Observe: `currentFrameIdxRef.current` is stuck at 0 when "K" should be playing
    - Run on UNFIXED code — **EXPECTED OUTCOME: FAIL** (K is cut off, lettersPlayed < 2)
    - Document counterexample: e.g. "K never completes; stale `stopAllPlayback` ref orphans K's interval"
    - Mark complete when test is written, run, and failure documented
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 1.3 Explore BUG 5 — Left hand threshold asymmetry
    - **Property 1: Bug Condition** - Left Hand False Detachment
    - File under test: `src/lib/holographic3DSkeleton.ts` (~line 715)
    - Scope: synthetic frame where `distance(vJointsL[0], vWristL) = 0.22` — isBugCondition_LeftHandThreshold returns TRUE (0.22 > 0.18, 0.22 ≤ 0.28)
    - Observe: `handValidL` is set to `false`; left hand landmarks are hidden despite valid hand position
    - Run on UNFIXED code — **EXPECTED OUTCOME: FAIL** (left hand hidden at 0.22, right hand at same distance would be visible)
    - Document counterexample: "wristDistL=0.22 → handValidL=false; right-hand equivalent at 0.22 → handValidR=true"
    - Mark complete when test is written, run, and failure documented
    - _Requirements: 5.1, 5.2_

  - [x] 1.4 Explore BUG 4 — API key in client bundle
    - **Property 1: Bug Condition** - NEXT_PUBLIC Key Exposure
    - File under test: `src/lib/agents/speechToSignAgent.ts` (~line 80)
    - Scope: inspect constructor — `process.env.NEXT_PUBLIC_GEMINI_API_KEY` fallback present = isBugCondition_KeyExposure returns TRUE
    - Observe: grep/inspect build output or source for `NEXT_PUBLIC_GEMINI_API_KEY` reference in speechToSignAgent.ts
    - Observe: no `import 'server-only'` guard present in file
    - Run on UNFIXED code — **EXPECTED OUTCOME: FAIL** (key reference present, no server-only guard)
    - Document counterexample: "Line 80 references NEXT_PUBLIC_GEMINI_API_KEY; no server-only import in file"
    - Mark complete when test is written, run, and failure documented
    - _Requirements: 4.1, 4.2_

  - [x] 1.5 Explore BUG 6 — Double render per frame
    - **Property 1: Bug Condition** - Parquet Frame Double Render
    - File under test: `src/app/test-kalidokit/page.tsx` (RAF loop + useEffect at lines 870–874)
    - Scope: load any parquet file, play for 1 second, count `renderParquetFrame` invocations — isBugCondition_DoubleRender returns TRUE (isPlaying=true, sourceMode='parquet')
    - Observe: add `console.count('renderParquetFrame')` inside the function; count doubles (~60/sec instead of ~30/sec)
    - Run on UNFIXED code — **EXPECTED OUTCOME: FAIL** (renderCallCount = 2 per frame)
    - Document counterexample: "RAF sets state → reactive effect fires → renderParquetFrame called twice for same idx"
    - Mark complete when test is written, run, and failure documented
    - _Requirements: 6.1, 6.2_

---

## Phase 2 — Preservation Baseline (Verify non-buggy behavior BEFORE fixing)

- [x] 2. Write preservation property tests (BEFORE implementing any fix)
  - **Property 2: Preservation** - Baseline Non-Buggy Behavior Suite
  - **IMPORTANT**: Follow observation-first methodology — run UNFIXED code with non-buggy inputs first, observe outputs, then encode as tests
  - **EXPECTED OUTCOME**: All preservation tests PASS on unfixed code (confirms baseline)

  - [x] 2.1 Preservation — Single-word playback at fixed speed
    - **Property 2: Preservation** - Single-Word Unchanged
    - Scope: inputs where `isBugCondition_ClosureStaleness(X)` is FALSE (queueLength = 1 AND speedUnchanged = true)
    - Observe on unfixed code: "HELLO" animates skeleton correctly with parquet frames
    - Write property: for all single known words with no speed change, `originalBehavior(sentence) = fixedBehavior(sentence)`
    - Verify test PASSES on unfixed code
    - _Requirements: 3.1, 3.2_

  - [x] 2.2 Preservation — Speed set before playback starts
    - **Property 2: Preservation** - Pre-Set Speed Unchanged
    - Scope: speed slider changed to 0.5×/0.75×/1.0× BEFORE submitting — not mid-playback
    - Observe on unfixed code: animation plays at selected speed correctly from frame 1
    - Write property: for all speed-pre-set single-word sessions, timing is unchanged
    - Verify test PASSES on unfixed code
    - _Requirements: 3.3_

  - [x] 2.3 Preservation — Right hand detachment threshold unchanged
    - **Property 2: Preservation** - Right Hand Threshold Unmodified
    - Scope: frames where `distance(vJointsR[0], vWristR) > 0.28` (right-hand bug condition equivalent)
    - Observe on unfixed code: right hand hidden at > 0.28 — threshold is 0.28
    - Write property: after fix, right-hand threshold remains 0.28 and behavior is identical
    - Also verify: left hand at `wristDistL ≤ 0.18` remains visible (unchanged lower range)
    - Verify test PASSES on unfixed code
    - _Requirements: 3.5_

  - [x] 2.4 Preservation — MOV mode unaffected in test-kalidokit
    - **Property 2: Preservation** - MOV Mode Unchanged
    - Scope: `sourceMode = 'mov'` — isBugCondition_DoubleRender is FALSE
    - Observe on unfixed code: MediaPipe Holistic RAF loop drives VRM and skeleton correctly
    - Write property: MOV mode behavior is identical before and after parquet double-render fix
    - Verify test PASSES on unfixed code
    - _Requirements: 3.8_

  - [x] 2.5 Preservation — Manual scrubbing in test-kalidokit
    - **Property 2: Preservation** - Scrubber Still Renders
    - Scope: `isPlaying = FALSE` AND `sourceMode = 'parquet'` — user manually scrubs
    - Observe on unfixed code: `onScrubberChange(5)` renders frame 5 exactly once (via reactive effect)
    - Write property: after fix, `onScrubberChange(idx)` still calls `renderParquetFrame(idx)` exactly once
    - Verify test PASSES on unfixed code
    - _Requirements: 3.6_

  - [x] 2.6 Preservation — Gemini fallback still functions
    - **Property 2: Preservation** - Rule-Based Fallback Intact
    - Scope: Gemini unavailable (mock HTTP 500) — isBugCondition_KeyExposure only covers build artifact
    - Observe on unfixed code: `processInput()` falls back to rule-based engine and returns valid token list
    - Write property: after speechToSignAgent.ts changes (Bug 4 fix), fallback behavior is identical
    - Verify test PASSES on unfixed code
    - _Requirements: 3.4, 3.9_

  - [x] 2.7 Preservation — glideToStandby fires after last word
    - **Property 2: Preservation** - End-of-Queue Standby Unchanged
    - Scope: animation queue fully consumed — isBugCondition_ClosureStaleness may be TRUE but standby must still fire
    - Observe on unfixed code: single-word sentence → skeleton glides to standby ~800ms after last frame
    - Write property: for all queue completions (single or multi-word), standby fires exactly once after last word
    - Verify test PASSES on unfixed code (single-word path always worked)
    - _Requirements: 3.10_

---

## Phase 3 — Implementation (Fixes in specified order)

- [x] 3. Fix BUG 5 — Left-hand detachment threshold asymmetry
  - **Safest fix: single-line change, no dependencies**
  - File: `src/lib/holographic3DSkeleton.ts`

  - [x] 3.1 Change threshold from 0.18 to 0.28
    - Location: `src/lib/holographic3DSkeleton.ts` ~line 715
    - Change `if (wristDistL > 0.18)` → `if (wristDistL > 0.28)`
    - DO NOT touch the right-hand equivalent block — right-hand threshold `0.28` must remain unchanged
    - DO NOT touch any other threshold or guard in the file
    - _Bug_Condition: isBugCondition_LeftHandThreshold(X) where distance(vJointsL[0], vWristL) > 0.18 AND ≤ 0.28_
    - _Expected_Behavior: handValidL = true, left hand renders when wristDistL ≤ 0.28_
    - _Preservation: wristDistL ≤ 0.18 still valid (no change); wristDistL > 0.28 still hidden (no change); right-hand path untouched_
    - _Requirements: 5.1, 5.2, 3.5_

  - [x] 3.2 Verify BUG 5 exploration test now passes
    - **Property 1: Expected Behavior** - Left Hand Visible at 0.22
    - **IMPORTANT**: Re-run the SAME test from task 1.3 — do NOT write a new test
    - Synthetic frame `wristDistL = 0.22` → `handValidL` must now be `true`
    - Run test — **EXPECTED OUTCOME: PASS** (confirms threshold fix works)
    - _Requirements: 5.1, 5.2_

  - [x] 3.3 Verify preservation tests 2.3 still pass
    - **Property 2: Preservation** - Right Hand Threshold Unmodified
    - Re-run task 2.3 tests
    - Confirm `wristDistL = 0.17` → still visible; `wristDistL = 0.30` → still hidden; right-hand path unchanged
    - **EXPECTED OUTCOME: PASS** (no regressions)

---

- [x] 4. Fix BUG 4 — API key server-only guard + remove NEXT_PUBLIC fallback
  - File: `src/lib/agents/speechToSignAgent.ts`

  - [x] 4.1 Add `import 'server-only'` as the first import
    - Add `import 'server-only';` as the very first import line in `src/lib/agents/speechToSignAgent.ts`
    - Must appear before all other imports (after any file-level comment/header only)
    - This ensures any accidental client-component import throws a build-time error
    - _Bug_Condition: isBugCondition_KeyExposure(X) where hasServerOnlyGuard = FALSE_
    - _Requirements: 4.2_

  - [x] 4.2 Remove `NEXT_PUBLIC_GEMINI_API_KEY` fallback from constructor (~line 80)
    - Change: `this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';`
    - To:     `this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';`
    - Remove only the `|| process.env.NEXT_PUBLIC_GEMINI_API_KEY` segment — no other constructor changes
    - _Bug_Condition: isBugCondition_KeyExposure(X) where containsNEXT_PUBLIC_GEMINI_API_KEY_reference = TRUE_
    - _Expected_Behavior: bundle.containsGeminiKeyValue = FALSE; server-only guard throws on client import_
    - _Preservation: GEMINI_API_KEY (no NEXT_PUBLIC prefix) still works; rule-based fallback unchanged; processInput() interface unchanged_
    - _Requirements: 4.1, 4.2, 3.4_

  - [x] 4.3 Verify BUG 4 exploration test now passes
    - **Property 1: Expected Behavior** - No NEXT_PUBLIC Key, Server-Only Guard Present
    - **IMPORTANT**: Re-run the SAME test from task 1.4 — do NOT write a new test
    - Verify: no `NEXT_PUBLIC_GEMINI_API_KEY` reference in speechToSignAgent.ts
    - Verify: `import 'server-only'` is the first import
    - Run test — **EXPECTED OUTCOME: PASS** (confirms key exposure fixed)
    - _Requirements: 4.1, 4.2_

  - [x] 4.4 Verify preservation tests 2.6 still pass
    - **Property 2: Preservation** - Rule-Based Fallback Intact
    - Re-run task 2.6 tests — Gemini mock 500 → fallback still returns valid token list
    - **EXPECTED OUTCOME: PASS** (no regressions)

---

- [x] 5. Fix BUG 6 — Double render per parquet frame in test-kalidokit
  - File: `src/app/test-kalidokit/page.tsx`

  - [x] 5.1 Add direct `renderParquetFrame(targetIdx)` call inside the RAF loop (Effect 6)
    - Location: Effect 6, inside the `if (targetIdx !== lastRenderedIdx)` block
    - After the existing `setCurrentFrameIdx(targetIdx)` call, add: `renderParquetFrame(targetIdx);`
    - This makes the RAF loop the single source of truth for frame rendering during playback
    - _Bug_Condition: isBugCondition_DoubleRender(X) where isPlaying=true AND sourceMode='parquet' AND reactiveEffectPresent=true_
    - _Requirements: 6.1_

  - [x] 5.2 Remove the reactive duplicate `useEffect` at lines 870–874
    - Delete the entire effect block:
      ```ts
      // DELETE THIS BLOCK:
      useEffect(() => {
        if (sourceMode === 'parquet' && parquetData) {
          renderParquetFrame(currentFrameIdx);
        }
      }, [currentFrameIdx, parquetData, sourceMode, renderParquetFrame]);
      ```
    - This effect was the accidental second render trigger; the RAF loop now owns rendering
    - _Requirements: 6.2_

  - [x] 5.3 Add direct `renderParquetFrame(newIdx)` call in `onScrubberChange`
    - Location: `onScrubberChange` handler in `src/app/test-kalidokit/page.tsx`
    - After `setCurrentFrameIdx(newIdx)`, add:
      ```ts
      if (sourceMode === 'parquet' && parquetData) {
        renderParquetFrame(newIdx);
      }
      ```
    - `stepFrame` calls `onScrubberChange` internally — it inherits this call automatically, no separate change needed
    - _Expected_Behavior: renderCallCount = 1 for both RAF playback and manual scrub_
    - _Preservation: MOV mode unaffected (guard: sourceMode === 'parquet'); manual scrub still renders once_
    - _Requirements: 6.1, 6.2, 6.3, 3.6, 3.8_

  - [x] 5.4 Verify BUG 6 exploration test now passes
    - **Property 1: Expected Behavior** - Parquet Frame Rendered Exactly Once
    - **IMPORTANT**: Re-run the SAME test from task 1.5 — do NOT write a new test
    - Play parquet file for 1 second — `renderParquetFrame` call count must equal frame count (~30), not 2×
    - Run test — **EXPECTED OUTCOME: PASS** (renderCallCount = 1 per frame)
    - _Requirements: 6.1, 6.2_

  - [x] 5.5 Verify preservation tests 2.4 and 2.5 still pass
    - **Property 2: Preservation** - MOV Mode and Manual Scrub Unchanged
    - Re-run task 2.4 (MOV mode) and task 2.5 (manual scrub) tests
    - MOV mode: Holistic RAF loop unaffected — **EXPECTED OUTCOME: PASS**
    - Manual scrub: `onScrubberChange(5)` → `renderParquetFrame(5)` called exactly once — **EXPECTED OUTCOME: PASS**

---

- [x] 6. Fix BUGs 1 + 2 + 3 — Stale closure dependency chain + fingerspell cutoff
  - **Root cause: useCallback dep chain; fix: route cross-function calls through stable refs + replace setInterval with recursive setTimeout**
  - File: `src/app/test-speech-to-sign/page.tsx`

  - [x] 6.1 Add `playbackSpeedRef` — stable ref synced to `playbackSpeed` state
    - After the existing `const [playbackSpeed, setPlaybackSpeed] = useState(1)` declaration, add:
      ```ts
      const playbackSpeedRef = useRef<number>(1);
      playbackSpeedRef.current = playbackSpeed; // sync at every render, no useEffect needed
      ```
    - This allows timer callbacks to read live speed without being in any dep array
    - _Requirements: 2.1, 2.2_

  - [x] 6.2 Add stable function refs for `stopAllPlayback` and `startPlayingFrames`
    - After the existing timer refs block (`playbackTimerRef`, `advanceTimeoutRef`, etc.), add:
      ```ts
      const stopAllPlaybackRef = useRef<() => void>(() => {});
      const startPlayingFramesRef = useRef<(frames: any[]) => void>(() => {});
      ```
    - Also add `playActionRef` for use in `advanceQueue`:
      ```ts
      const playActionRef = useRef<(action: ChoreographedSignAction) => void>(() => {});
      ```
    - _Requirements: 2.2, 2.3_

  - [x] 6.3 Rewrite `stopAllPlayback` with empty deps array, assign to ref
    - Rewrite `stopAllPlayback` `useCallback`:
      - Change `clearInterval` → `clearTimeout` (matching new recursive-setTimeout pattern)
      - Change dep array from `[playbackTimerRef, advanceTimeoutRef, standbyTimeoutRef]` to `[]` (all reads go through refs)
      - All timer refs are already stable refs — they never need to be in the dep array
    - After the `useCallback`, assign: `stopAllPlaybackRef.current = stopAllPlayback;`
    - _Bug_Condition: stale stopAllPlayback ref cleared wrong timer handle_
    - _Requirements: 2.2, 2.3_

  - [x] 6.4 Rewrite `startPlayingFrames` with recursive `setTimeout` pattern, assign to ref
    - Replace the existing `setInterval`-based `startPlayingFrames` with the recursive `setTimeout` pattern:
      ```ts
      const startPlayingFrames = useCallback((frameList: any[]) => {
        if (!frameList || frameList.length === 0) return;
        stopAllPlaybackRef.current();           // via ref, not closure dep
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
                advanceQueueRef.current();      // always-current ref
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
      }, [smoothMotion]); // only smoothMotion — no stopAllPlayback, no playbackSpeed in deps
      ```
    - After the `useCallback`, assign: `startPlayingFramesRef.current = startPlayingFrames;`
    - _Bug_Condition: isBugCondition_ClosureStaleness — setInterval captured stale speed; stale stopAllPlayback in closure_
    - _Expected_Behavior: every frame reads playbackSpeedRef.current live; advance always calls advanceQueueRef.current_
    - _Requirements: 2.1, 2.2, 3.2_

  - [x] 6.5 Update `playAction` to call via refs, remove stale deps
    - Inside `playAction`, replace ALL direct `stopAllPlayback(...)` calls → `stopAllPlaybackRef.current()`
    - Inside `playAction`, replace ALL direct `startPlayingFrames(...)` calls → `startPlayingFramesRef.current(...)`
    - Change `useCallback` dep array from `[smoothMotion, startPlayingFrames, stopAllPlayback]` → `[smoothMotion]`
    - After the `useCallback`, assign: `playActionRef.current = playAction;`
    - _Bug_Condition: playAction was async; during await, state change recreated startPlayingFrames; stale closure used after await_
    - _Requirements: 2.2, 2.3, 3.1, 3.2_

  - [x] 6.6 Update `advanceQueue` to call `playAction` via ref, remove stale deps
    - Inside `advanceQueue`, replace direct `playAction(nextAction)` call → `playActionRef.current(nextAction)`
    - Change `useCallback` dep array from `[playAction, glideToStandby, replayFullSequence]` → `[glideToStandby, replayFullSequence]`
    - `advanceQueueRef.current = advanceQueue` assignment (already present) remains — no change needed there
    - _Bug_Condition: advanceQueue held stale playAction in dep chain_
    - _Preservation: glideToStandby and replayFullSequence behavior unchanged_
    - _Requirements: 2.2, 2.3, 3.10_

  - [x] 6.7 Verify BUG 1 & 2 exploration test now passes
    - **Property 1: Expected Behavior** - Multi-Word Queue Plays to Completion
    - **IMPORTANT**: Re-run the SAME tests from task 1.1 — do NOT write new tests
    - "WATER GOOD": both words animate sequentially, `currentActionIndexRef.current` advances to 1
    - Speed change mid-animation: remaining frames play at new speed within 1 tick (~16ms or ~33ms per `playbackSpeedRef.current`)
    - Run tests — **EXPECTED OUTCOME: PASS** (all words play; speed applies live)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 6.8 Verify BUG 3 exploration test now passes
    - **Property 1: Expected Behavior** - Fingerspell Sequence Completes All Letters
    - **IMPORTANT**: Re-run the SAME test from task 1.2 — do NOT write a new test
    - "OK": both O and K play fully (14 frames each); `lettersPlayed = 2`
    - Run test — **EXPECTED OUTCOME: PASS** (all letters complete)
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.9 Verify preservation tests 2.1, 2.2, 2.7 still pass
    - **Property 2: Preservation** - Single-Word, Pre-Set Speed, and Standby Unchanged
    - Re-run tasks 2.1, 2.2, 2.7
    - Single-word "HELLO": animates identically — **EXPECTED OUTCOME: PASS**
    - Speed pre-set 0.5×: plays at correct speed from frame 1 — **EXPECTED OUTCOME: PASS**
    - End-of-queue standby: glideToStandby fires after last word — **EXPECTED OUTCOME: PASS**

---

## Phase 4 — Improvements (Layered on top of bug fixes)

- [x] 7. Improvement A + B — Gemini timeout + structured fallback logging
  - File: `src/lib/agents/speechToSignAgent.ts`
  - These improvements build directly on the BUG 4 fix (server-only guard already in place)

  - [x] 7.1 Add `AbortController` with 3000ms timeout inside `ISLGrammarSubAgent.parseGrammar()`
    - Add at top of `parseGrammar()`:
      ```ts
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      ```
    - Pass `signal: controller.signal` to the `fetch(...)` call for the Gemini API
    - Call `clearTimeout(timeoutId)` on successful response and in the catch block
    - _Requirements: B.1_

  - [x] 7.2 Add structured fallback logging for all failure paths
    - On non-OK HTTP status: `console.warn('[ISLGrammarSubAgent] Gemini HTTP ${res.status}, using rule-based engine');`
    - On JSON parse failure: `console.warn('[ISLGrammarSubAgent] JSON parse failed, using rule-based engine. Raw:', rawResponseText);`
    - On AbortError (timeout): `console.warn('[ISLGrammarSubAgent] Gemini timed out (3000ms), using rule-based engine');`
    - On other errors: `console.warn('[ISLGrammarSubAgent] Gemini call failed, using rule-based engine:', err);`
    - All paths fall through to `return this.ruleBasedFallback(cleanText);`
    - `processInput()` public interface and return type must remain unchanged
    - _Preservation: rule-based fallback still works; processInput() signature unchanged_
    - _Requirements: B.1, B.2, 3.9_

  - [x] 7.3 Verify preservation test 2.6 still passes after Improvement A+B
    - Re-run task 2.6 — Gemini mock 500 → fallback returns valid token list, console.warn logged
    - **EXPECTED OUTCOME: PASS** (fallback path intact, now with structured logging)

---

- [x] 8. Improvement C — Next-word parquet prefetch pipeline
  - File: `src/app/test-speech-to-sign/page.tsx`
  - Builds on BUG 1+2+3 fix (startPlayingFrames and playAction already refactored)

  - [x] 8.1 Add `prefetchCacheRef` after existing timer refs
    - After the timer refs block in `src/app/test-speech-to-sign/page.tsx`, add:
      ```ts
      const prefetchCacheRef = useRef<Map<string, any[]>>(new Map());
      ```
    - _Requirements: C.1_

  - [x] 8.2 Add background prefetch trigger inside `startPlayingFrames`
    - After `scheduleNextFrame()` is called in the refactored `startPlayingFrames` (task 6.4), add a non-blocking prefetch for the next queue item:
      ```ts
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
          .catch(() => {}); // silent failure — normal fetch in playAction is fallback
      }
      ```
    - _Requirements: C.1, C.3_

  - [x] 8.3 Add cache-hit fast path in `playAction`
    - At the top of the `parquetWord` branch in `playAction`, before the `await fetch(...)`, add:
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
        // ... existing fetch logic unchanged
      }
      ```
    - _Expected_Behavior: cache hit → zero HTTP fetch latency; cache miss → normal fetch unchanged_
    - _Preservation: single-word playback unchanged (cache miss on first word); prefetch failure silent_
    - _Requirements: C.2, C.3, 3.1_

---

- [x] 9. Improvement D — Loading overlay in 3D viewport
  - File: `src/app/test-speech-to-sign/page.tsx`

  - [x] 9.1 Add `relative` positioning to 3D viewport container `div`
    - Locate the 3D viewport container `div` in `src/app/test-speech-to-sign/page.tsx`
    - Ensure `relative` is in its `className` (add only if not already present — read the file first)
    - _Requirements: D.1_

  - [x] 9.2 Add conditional loading overlay as first child of 3D viewport `div`
    - Insert as the first child of the 3D viewport container:
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
    - `isLoadingFrames` state is already defined — no new state needed
    - _Expected_Behavior: overlay visible while fetching parquet data; disappears immediately when loading completes_
    - _Preservation: overlay is pointer-events-none (does not block 3D canvas interaction); no layout shift_
    - _Requirements: D.1, D.2_

---

## Phase 5 — Final Checkpoint

- [x] 10. Checkpoint — Ensure all tests pass
  - Run the full test suite (unit + property-based + integration)
  - Verify all five bug condition exploration tests (tasks 1.1–1.5) PASS on fixed code
  - Verify all seven preservation tests (tasks 2.1–2.7) PASS
  - Verify no TypeScript compilation errors across all four modified files:
    - `src/lib/holographic3DSkeleton.ts`
    - `src/lib/agents/speechToSignAgent.ts`
    - `src/app/test-kalidokit/page.tsx`
    - `src/app/test-speech-to-sign/page.tsx`
  - Run `next build` to confirm `import 'server-only'` guard is enforced and no `NEXT_PUBLIC_GEMINI_API_KEY` leaks into bundle
  - Ask the user if any questions or ambiguities arise before considering this spec complete
  - _Requirements: 2.1, 2.2, 2.3, 3.1–3.10, 4.1, 4.2, 5.1, 5.2, 6.1–6.3, B.1, B.2, C.1–C.3, D.1, D.2_
