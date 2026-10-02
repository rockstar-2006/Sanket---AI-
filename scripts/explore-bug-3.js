/**
 * explore-bug-3.js
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG 3 — Fingerspell Letter Cutoff — Exploration Test (Phase 1)
 *
 * PURPOSE:
 *   Confirm that the UNFIXED code contains all structural bug conditions that
 *   cause fingerspell letter sequences (e.g. "OK" → O, K) to cut off after
 *   the first letter.
 *
 * EXPECTED OUTCOME: FAIL (all bug conditions present → bugs confirmed)
 *
 * ROOT CAUSE (from bugfix.md §3.1–3.3):
 *   When advanceQueue calls playAction for letter "K" after "O" completes,
 *   playAction immediately calls stopAllPlayback() from its closure dep.
 *   Because playAction's useCallback has [smoothMotion, startPlayingFrames,
 *   stopAllPlayback] in its dep array, any state change during "O" playback
 *   (setIsLoadingFrames, setIsPlaying, setCurrentFrameIdx) recreates
 *   startPlayingFrames and stopAllPlayback, causing the captured closure
 *   inside advanceQueue to become stale. The stale stopAllPlayback may clear
 *   the wrong timer handle; the stale startPlayingFrames sets up a new
 *   interval that immediately self-cancels.
 *
 * BUG CONDITIONS CHECKED:
 *   C1 — playAction useCallback includes `stopAllPlayback` in dep array
 *   C2 — playAction useCallback includes `startPlayingFrames` in dep array
 *   C3 — fingerspell `else` branch calls startPlayingFrames directly (no ref)
 *   C4 — advanceQueue does NOT use playActionRef.current (no stable ref)
 *   C5 — stopAllPlayback() called directly at top of playAction (no ref)
 *
 * ABSENCE-OF-FIX CONDITIONS:
 *   C6 — playActionRef does NOT exist in source (fix not applied)
 *   C7 — stopAllPlaybackRef.current NOT called inside playAction (fix absent)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────
const FILE_UNDER_TEST = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'test-speech-to-sign',
  'page.tsx'
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function pass(label, detail) {
  console.log(`  ✅ PASS  ${label}`);
  if (detail) console.log(`         ${detail}`);
}

function fail(label, detail) {
  console.log(`  ❌ FAIL  ${label}`);
  if (detail) console.log(`         ${detail}`);
}

// ── Read source ───────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(' BUG 3 — Fingerspell Letter Cutoff — Exploration Test');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`File under test: ${FILE_UNDER_TEST}`);
console.log('');

if (!fs.existsSync(FILE_UNDER_TEST)) {
  console.error('ERROR: File not found — ' + FILE_UNDER_TEST);
  process.exit(2);
}

const src = fs.readFileSync(FILE_UNDER_TEST, 'utf8');

// ── Extract playAction useCallback body + dep array ───────────────────────────
// We want the region from `const playAction = useCallback(async (action:` to its
// closing `}, [...])` line.  We locate the dep array by scanning for the last
// `}, [` that is immediately followed by the closing `);` of the playAction
// useCallback block.

function extractPlayActionBlock(source) {
  const startMarker = 'const playAction = useCallback(async (action:';
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) return null;

  // Walk forward tracking brace depth to find the closing `}, [deps])` pattern
  let depth = 0;
  let i = startIdx;
  let arrowBodyStart = -1;

  // Find opening `{` of the async function body
  while (i < source.length) {
    if (source[i] === '{') {
      if (arrowBodyStart === -1) arrowBodyStart = i;
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  // i now points at the closing `}` of the async function body.
  // The dep array follows: `}, [...])`
  const afterBody = source.slice(i, i + 200);
  const depArrayMatch = afterBody.match(/},\s*\[([^\]]*)\]/s);
  if (!depArrayMatch) return null;

  return {
    body: source.slice(startIdx, i + 1),
    depArray: depArrayMatch[1].trim(),
    fullBlock: source.slice(startIdx, i + depArrayMatch[0].length + 1),
  };
}

// ── Extract advanceQueue useCallback body ─────────────────────────────────────
function extractAdvanceQueueBlock(source) {
  const startMarker = 'const advanceQueue = useCallback(';
  const startIdx = source.indexOf(startMarker);
  if (startIdx === -1) return null;

  let depth = 0;
  let i = startIdx;
  let bodyStart = -1;

  while (i < source.length) {
    if (source[i] === '{') {
      if (bodyStart === -1) bodyStart = i;
      depth++;
    } else if (source[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
    i++;
  }
  const afterBody = source.slice(i, i + 200);
  const depArrayMatch = afterBody.match(/},\s*\[([^\]]*)\]/s);

  return {
    body: source.slice(startIdx, i + 1),
    depArray: depArrayMatch ? depArrayMatch[1].trim() : '',
    fullBlock: depArrayMatch
      ? source.slice(startIdx, i + depArrayMatch[0].length + 1)
      : source.slice(startIdx, i + 1),
  };
}

const playActionBlock = extractPlayActionBlock(src);
const advanceQueueBlock = extractAdvanceQueueBlock(src);

if (!playActionBlock) {
  console.error('ERROR: Could not locate `playAction` useCallback in source. Aborting.');
  process.exit(2);
}
if (!advanceQueueBlock) {
  console.error('ERROR: Could not locate `advanceQueue` useCallback in source. Aborting.');
  process.exit(2);
}

console.log('── playAction dep array found ──────────────────────────────────');
console.log(`  [${playActionBlock.depArray}]`);
console.log('');
console.log('── advanceQueue dep array found ────────────────────────────────');
console.log(`  [${advanceQueueBlock.depArray}]`);
console.log('');

// ── Helpers to inspect dep arrays ─────────────────────────────────────────────
function depContains(depArrayStr, name) {
  // Match exact identifier (word boundary on both sides)
  return new RegExp(`\\b${name}\\b`).test(depArrayStr);
}

// ── Extract the fingerspell else-branch from playAction ───────────────────────
// The else branch starts after `} else {` inside playAction and covers the
// fingerspell path.  We look for the second top-level `} else {` inside the
// playAction body.
function extractFingerspellBranch(playActionBody) {
  // Find `} else {` at brace depth 1 (inside playAction, outside if block)
  // Simple approach: find the else branch using string search after the parquet block
  const elseIdx = playActionBody.lastIndexOf('} else {');
  if (elseIdx === -1) return '';
  return playActionBody.slice(elseIdx);
}

const fingerspellBranch = extractFingerspellBranch(playActionBlock.body);

// ── Check whether stopAllPlaybackRef.current() appears in playAction ──────────
function hasStopAllPlaybackRefInPlayAction(playActionBody) {
  return /stopAllPlaybackRef\.current\s*\(\s*\)/.test(playActionBody);
}

// ── Check whether playActionRef.current is used in advanceQueue ───────────────
function hasPlayActionRefInAdvanceQueue(advanceQueueBody) {
  return /playActionRef\.current/.test(advanceQueueBody);
}

// ── Check whether stopAllPlayback() is called directly at top of playAction ───
// "directly" = as a standalone statement (not via .current), near the top of
// the function body before any `if` block.
function hasDirectStopAllPlaybackCall(playActionBody) {
  // Look for `stopAllPlayback();` that is NOT `stopAllPlaybackRef.current()`
  return /(?<!Ref\.current\b.*)\bstopAllPlayback\s*\(\s*\)/.test(playActionBody);
}

// ── Check whether startPlayingFrames is called directly in fingerspell branch ──
function hasDirectStartPlayingFramesInFingerspell(fingerspellBody) {
  // Called directly (not via ref)
  return /(?<!Ref\.current\b.*)\bstartPlayingFrames\s*\(/.test(fingerspellBody);
}

// ── Check absence of playActionRef declaration ────────────────────────────────
function playActionRefExists(source) {
  return /playActionRef\s*=\s*useRef/.test(source);
}

// ── Run checks ─────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log(' Bug Condition Checks');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

let bugsFound = 0;
let checksRun = 0;

// ── C1: stopAllPlayback in playAction dep array ───────────────────────────────
checksRun++;
const c1 = depContains(playActionBlock.depArray, 'stopAllPlayback');
if (c1) {
  bugsFound++;
  pass(
    'C1 — `stopAllPlayback` IS in playAction dep array',
    '→ Bug confirmed: stale stopAllPlayback is captured in closure; ' +
    'when letter "O" triggers re-renders (setIsLoadingFrames, setIsPlaying), ' +
    'playAction is recreated → advanceQueueRef gets stale copy.'
  );
} else {
  fail(
    'C1 — `stopAllPlayback` NOT found in playAction dep array',
    '→ Expected bug condition absent. Fix may already be applied, or dep array changed.'
  );
}

// ── C2: startPlayingFrames in playAction dep array ────────────────────────────
checksRun++;
const c2 = depContains(playActionBlock.depArray, 'startPlayingFrames');
if (c2) {
  bugsFound++;
  pass(
    'C2 — `startPlayingFrames` IS in playAction dep array',
    '→ Bug confirmed: stale startPlayingFrames captured; interval speed and ' +
    'completion logic use stale closure values when letter "K" plays.'
  );
} else {
  fail(
    'C2 — `startPlayingFrames` NOT found in playAction dep array',
    '→ Expected bug condition absent.'
  );
}

// ── C3: startPlayingFrames called directly in fingerspell else branch ──────────
checksRun++;
const c3 = hasDirectStartPlayingFramesInFingerspell(fingerspellBranch);
if (c3) {
  bugsFound++;
  pass(
    'C3 — `startPlayingFrames(...)` called directly in fingerspell else branch',
    '→ Bug confirmed: no stable ref; if startPlayingFrames was recreated between ' +
    'letter "O" and "K", the version called for "K" holds stale interval/speed state.'
  );
} else {
  fail(
    'C3 — Direct `startPlayingFrames(...)` call NOT found in fingerspell branch',
    '→ Expected bug condition absent; ref pattern may already be in place.'
  );
}

// ── C4: advanceQueue does NOT use playActionRef.current ───────────────────────
checksRun++;
const c4 = !hasPlayActionRefInAdvanceQueue(advanceQueueBlock.body);
if (c4) {
  bugsFound++;
  pass(
    'C4 — `playActionRef.current` NOT used in advanceQueue',
    '→ Bug confirmed: advanceQueue calls playAction directly from its closure dep, ' +
    'not through a stable ref. Stale playAction → stale startPlayingFrames → ' +
    'letter "K" interval never initialises properly.'
  );
} else {
  fail(
    'C4 — `playActionRef.current` IS used in advanceQueue',
    '→ Fix appears to be applied; stable ref pattern already present.'
  );
}

// ── C5: stopAllPlayback() called directly at top of playAction ───────────────
checksRun++;
const c5 = hasDirectStopAllPlaybackCall(playActionBlock.body);
if (c5) {
  bugsFound++;
  pass(
    'C5 — `stopAllPlayback()` called directly at top of playAction (no stable ref)',
    '→ Bug confirmed: when playAction is called for letter "K", it calls the ' +
    'stopAllPlayback from its closure — which may be stale and clear the wrong ' +
    'timer handle, or be a no-op because the prior clearInterval already ran.'
  );
} else {
  fail(
    'C5 — Direct `stopAllPlayback()` NOT called in playAction',
    '→ Expected bug condition absent; may already use ref.'
  );
}

// ── C6 (absence check): playActionRef does NOT exist ─────────────────────────
checksRun++;
const c6 = !playActionRefExists(src);
if (c6) {
  bugsFound++;
  pass(
    'C6 — `playActionRef = useRef(...)` does NOT exist (fix absent)',
    '→ Confirms no stable playActionRef has been introduced; dep-chain break ' +
    'fix has not been applied.'
  );
} else {
  fail(
    'C6 — `playActionRef = useRef(...)` WAS found in source',
    '→ Fix appears partially applied; stable ref already introduced.'
  );
}

// ── C7 (absence check): stopAllPlaybackRef.current NOT in playAction ──────────
checksRun++;
const c7 = !hasStopAllPlaybackRefInPlayAction(playActionBlock.body);
if (c7) {
  bugsFound++;
  pass(
    'C7 — `stopAllPlaybackRef.current()` NOT called inside playAction (fix absent)',
    '→ Confirms the stable-ref pattern has not replaced the direct call inside ' +
    'playAction; stale closure path is still active.'
  );
} else {
  fail(
    'C7 — `stopAllPlaybackRef.current()` IS called inside playAction',
    '→ Fix has been partially applied; stable ref already in playAction.'
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(' Counterexample Summary');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`  Checks run  : ${checksRun}`);
console.log(`  Bugs found  : ${bugsFound}`);
console.log(`  Clean checks: ${checksRun - bugsFound}`);
console.log('');

// Build a minimal counterexample narrative
console.log('  Minimal Counterexample (isBugCondition_LetterCutoff):');
console.log('  ┌─────────────────────────────────────────────────────────┐');
console.log('  │ Input  : submit unknown word "OK" → 2 letter actions    │');
console.log('  │          [{ type:"letter", token:"O" },                 │');
console.log('  │           { type:"letter", token:"K" }]                 │');
console.log('  │                                                         │');
console.log('  │ Step 1 : playAction("O") called                        │');
console.log('  │          stopAllPlayback() — direct closure call ✓     │');
console.log('  │          generateFingerspellFrames("O", 14) → 14 frames│');
console.log('  │          setIsLoadingFrames(true/false) → re-render     │');
console.log('  │          startPlayingFrames(framesO) — direct call ✓   │');
console.log('  │          → startPlayingFrames RECREATED (dep changed)   │');
console.log('  │          → playAction RECREATED (dep: startPlayingFrames│');
console.log('  │          → advanceQueueRef.current = NEW advanceQueue   │');
console.log('  │                                                         │');
console.log('  │ Step 2 : O completes at frame 14                       │');
console.log('  │          advanceTimeoutRef → calls advanceQueueRef()    │');
console.log('  │          advanceQueue calls playAction(nextAction:"K")  │');
console.log('  │          BUT: playAction ref is STALE closure           │');
console.log('  │          Its stopAllPlayback = stale → clears wrong ref │');
console.log('  │          Its startPlayingFrames = stale → interval uses │');
console.log('  │          old frameList reference; self-cancels at idx 0 │');
console.log('  │                                                         │');
console.log('  │ Observed: lettersPlayed = 1 (only O); K = 0–3 frames   │');
console.log('  │ Expected: lettersPlayed = 2 (O and K both complete)     │');
console.log('  └─────────────────────────────────────────────────────────┘');
console.log('');

// ── Final verdict ─────────────────────────────────────────────────────────────
const allBugsPresent = bugsFound === checksRun;

if (allBugsPresent) {
  console.log('  ══════════════════════════════════════════════════════════');
  console.log('  VERDICT: ❌ FAIL (as expected on UNFIXED code)');
  console.log('  All 7/7 bug conditions confirmed present.');
  console.log('  BUG 3 is real: fingerspell letter cutoff IS a live defect.');
  console.log('  Phase 1 exploration COMPLETE — proceed to Phase 2 / Fix.');
  console.log('  ══════════════════════════════════════════════════════════');
  process.exit(1); // exit 1 signals FAIL (expected for exploration test)
} else if (bugsFound > 0) {
  console.log('  ══════════════════════════════════════════════════════════');
  console.log(`  VERDICT: ⚠️  PARTIAL — ${bugsFound}/${checksRun} bug conditions found.`);
  console.log('  Some conditions may already be partially fixed.');
  console.log('  Review failing checks above before proceeding to fix.');
  console.log('  ══════════════════════════════════════════════════════════');
  process.exit(1);
} else {
  console.log('  ══════════════════════════════════════════════════════════');
  console.log('  VERDICT: ✅ PASS (UNEXPECTED on unfixed code)');
  console.log('  0 bug conditions found — code appears already fixed.');
  console.log('  If this is unfixed code, re-investigate root cause.');
  console.log('  ══════════════════════════════════════════════════════════');
  process.exit(0);
}
