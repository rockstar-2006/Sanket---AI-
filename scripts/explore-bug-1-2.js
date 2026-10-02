/**
 * Bug Condition Exploration Test — Task 1.1
 * BUG 1 & 2: Stale Closure / Multi-Word Queue Dropout
 *
 * Phase 1 EXPLORATION: This script runs against UNFIXED code.
 * Expected outcome: ALL bug conditions FOUND → exit(0) = bugs confirmed present.
 * If any pattern is NOT FOUND → exit(1) = unexpected pass (bug doesn't exist or already fixed).
 *
 * Bug conditions checked:
 *
 * BUG 1 — Speed closure staleness:
 *   C1: `setInterval` is used in `startPlayingFrames`
 *   C2: `playbackSpeed` is in `startPlayingFrames` useCallback dep array
 *   C3: `intervalMs` is computed from `playbackSpeed` (captured at creation time, not live)
 *
 * BUG 2 — Dep chain staleness:
 *   C4: `stopAllPlayback` is in `startPlayingFrames` dep array  (dep chain link 1)
 *   C5: `startPlayingFrames` is in `playAction` dep array       (dep chain link 2)
 *   C6: `stopAllPlayback` is in `playAction` dep array          (dep chain link 3)
 *   C7: `playAction` is in `advanceQueue` dep array             (dep chain link 4 — final link)
 *
 * Root cause: Any React state change (e.g. setIsLoadingFrames during fetch) that touches this
 * chain recreates all four functions. The running setInterval/advanceQueueRef holds the stale
 * prior closure, so multi-word sentences drop words 2+.
 *
 * Requirements: 2.1, 2.2, 2.3
 */

const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'test-speech-to-sign',
  'page.tsx'
);

console.log('='.repeat(72));
console.log('EXPLORATION TEST — Task 1.1: BUG 1 & 2 Stale Closure / Queue Dropout');
console.log('='.repeat(72));
console.log(`\nTarget file: ${FILE_PATH}\n`);

// ── Read source ────────────────────────────────────────────────────────────────
let source;
try {
  source = fs.readFileSync(FILE_PATH, 'utf-8');
  console.log(`File read OK (${source.length} chars, ${source.split('\n').length} lines)\n`);
} catch (err) {
  console.error(`FATAL: Cannot read source file — ${err.message}`);
  process.exit(1);
}

// ── Helper ─────────────────────────────────────────────────────────────────────
let allFound = true;
const results = [];

function check(id, description, testFn, requirement) {
  const found = testFn(source);
  const status = found ? 'FOUND ✓' : 'NOT FOUND ✗';
  if (!found) allFound = false;
  results.push({ id, description, found, requirement });
  console.log(`  [${id}] ${status}`);
  console.log(`        ${description}`);
  console.log(`        Requirement: ${requirement}\n`);
}

// ── BUG 1: Speed Closure Staleness ────────────────────────────────────────────
console.log('── BUG 1: Playback Speed Baked Into Interval At Creation Time ──────────\n');

check(
  'C1',
  'setInterval is used inside startPlayingFrames (not recursive setTimeout)',
  (src) => {
    // The setInterval call should be inside startPlayingFrames; look for the pattern
    // "setInterval(" appearing between the startPlayingFrames useCallback opening and its closing dep array
    const startIdx = src.indexOf('const startPlayingFrames = useCallback(');
    const endIdx = src.indexOf('}, [playbackSpeed, smoothMotion, stopAllPlayback]);', startIdx);
    if (startIdx === -1 || endIdx === -1) return false;
    const body = src.slice(startIdx, endIdx);
    return body.includes('setInterval(');
  },
  'Requirements 2.1, 2.2'
);

check(
  'C2',
  '`playbackSpeed` state appears in startPlayingFrames useCallback dep array',
  (src) => {
    // The dep array for startPlayingFrames: }, [playbackSpeed, smoothMotion, stopAllPlayback]);
    return /\},\s*\[playbackSpeed,\s*smoothMotion,\s*stopAllPlayback\]\)/.test(src);
  },
  'Requirements 2.1, 2.2'
);

check(
  'C3',
  '`intervalMs` is computed from closure-captured `playbackSpeed` (not a ref)',
  (src) => {
    // Look for: const intervalMs = Math.round((1000 / 30) / playbackSpeed)
    // Confirms speed is baked in at interval creation — not read live
    return /const\s+intervalMs\s*=\s*Math\.round\(\s*\(\s*1000\s*\/\s*30\s*\)\s*\/\s*playbackSpeed\s*\)/.test(src);
  },
  'Requirements 2.1, 2.2'
);

// ── BUG 2: Dep Chain Staleness ─────────────────────────────────────────────────
console.log('── BUG 2: useCallback Dep Chain — stopAllPlayback→startPlayingFrames→playAction→advanceQueue ──\n');

check(
  'C4',
  '`stopAllPlayback` is in startPlayingFrames dep array (dep chain link 1: closure capture)',
  (src) => {
    // The dep array confirms stopAllPlayback is captured in startPlayingFrames closure
    return /\},\s*\[playbackSpeed,\s*smoothMotion,\s*stopAllPlayback\]\)/.test(src);
  },
  'Requirements 2.2, 2.3'
);

check(
  'C5',
  '`startPlayingFrames` is in playAction dep array (dep chain link 2)',
  (src) => {
    // playAction dep array: [smoothMotion, startPlayingFrames, stopAllPlayback]
    return /\},\s*\[smoothMotion,\s*startPlayingFrames,\s*stopAllPlayback\]\)/.test(src);
  },
  'Requirements 2.2, 2.3'
);

check(
  'C6',
  '`stopAllPlayback` is in playAction dep array (dep chain link 3)',
  (src) => {
    // Same dep array as C5 — confirms stopAllPlayback is also in playAction deps
    return /\},\s*\[smoothMotion,\s*startPlayingFrames,\s*stopAllPlayback\]\)/.test(src);
  },
  'Requirements 2.2, 2.3'
);

check(
  'C7',
  '`playAction` is in advanceQueue dep array (dep chain link 4 — terminal link)',
  (src) => {
    // advanceQueue dep array: [playAction, glideToStandby, replayFullSequence]
    return /\},\s*\[playAction,\s*glideToStandby,\s*replayFullSequence\]\)/.test(src);
  },
  'Requirements 2.2, 2.3'
);

// ── Absence check: stable refs NOT present (no fix applied) ───────────────────
console.log('── Absence Check: Fix Should NOT Be Present In Unfixed Code ─────────────\n');

check(
  'C8',
  '`playbackSpeedRef` stable ref does NOT exist (fix not yet applied)',
  (src) => {
    // After the fix, playbackSpeedRef.current = playbackSpeed; would be present
    // On unfixed code this line should be absent
    return !src.includes('playbackSpeedRef.current = playbackSpeed');
  },
  'Requirements 2.1 — confirms unfixed code'
);

check(
  'C9',
  '`startPlayingFramesRef` stable ref does NOT exist (fix not yet applied)',
  (src) => {
    return !src.includes('startPlayingFramesRef');
  },
  'Requirements 2.2 — confirms unfixed code'
);

check(
  'C10',
  '`stopAllPlaybackRef` stable ref does NOT exist (fix not yet applied)',
  (src) => {
    return !src.includes('stopAllPlaybackRef');
  },
  'Requirements 2.3 — confirms unfixed code'
);

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('='.repeat(72));
console.log('SUMMARY');
console.log('='.repeat(72));

const found = results.filter((r) => r.found).length;
const total = results.length;

results.forEach((r) => {
  const icon = r.found ? '✓' : '✗';
  console.log(`  [${icon}] ${r.id}: ${r.description}`);
});

console.log(`\nResult: ${found}/${total} bug conditions confirmed present.\n`);

if (allFound) {
  console.log('✅ ALL BUG CONDITIONS CONFIRMED — Bugs 1 & 2 exist in unfixed code.');
  console.log('   This is the EXPECTED OUTCOME for Phase 1 exploration.');
  console.log('   The test "FAILS" (bugs are present), which CONFIRMS the root cause.');
  console.log('\n   Counterexample documented:');
  console.log('   • startPlayingFrames captures `playbackSpeed` at setInterval creation time.');
  console.log('     Speed changes mid-playback have zero effect on the running interval.');
  console.log('   • Dep chain: stopAllPlayback→startPlayingFrames→playAction→advanceQueue');
  console.log('     Any re-render during async fetch in playAction invalidates the chain.');
  console.log('     Multi-word sentences (queue > 1): word 2+ never plays.');
  console.log('   • No stable refs (playbackSpeedRef, startPlayingFramesRef, stopAllPlaybackRef)');
  console.log('     exist to break the stale closure cycle.\n');
  process.exit(0); // exit(0) = all bugs confirmed = expected pass for exploration phase
} else {
  const missing = results.filter((r) => !r.found);
  console.log('⚠️  UNEXPECTED: Some bug conditions were NOT found in the source.');
  console.log('   This means either:');
  console.log('   (a) The code was already partially fixed, OR');
  console.log('   (b) The source patterns changed and the test needs updating.\n');
  console.log('   Missing conditions:');
  missing.forEach((r) => console.log(`   • ${r.id}: ${r.description}`));
  console.log('');
  process.exit(1); // exit(1) = unexpected pass = bugs may not exist
}
