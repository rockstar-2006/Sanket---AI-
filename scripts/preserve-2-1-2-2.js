/**
 * Preservation Baseline Checks — Tasks 2.1 & 2.2
 *
 * Task 2.1 — Single-word playback at fixed speed
 * Task 2.2 — Speed set before playback starts
 *
 * These are static code analysis checks that verify non-buggy behaviors
 * ARE present in the UNFIXED code. All checks must PASS (exit 0).
 *
 * Target: src/app/test-speech-to-sign/page.tsx
 */

'use strict';

const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '../src/app/test-speech-to-sign/page.tsx');

// ─── Load source ─────────────────────────────────────────────────────────────
if (!fs.existsSync(FILE)) {
  console.error(`FATAL: Source file not found: ${FILE}`);
  process.exit(1);
}

const src = fs.readFileSync(FILE, 'utf8');

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    if (detail) console.error(`        => ${detail}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2.1 — Single-word playback at fixed speed
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Task 2.1 · Single-word playback at fixed speed ──────────────────────────\n');

// 2.1-A: startPlayingFrames useCallback exists
check(
  '2.1-A  startPlayingFrames useCallback is declared',
  /const\s+startPlayingFrames\s*=\s*useCallback\s*\(/.test(src),
  'Expected: const startPlayingFrames = useCallback('
);

// 2.1-B: advanceQueueRef.current = advanceQueue assignment exists (the ref is updated each render)
check(
  '2.1-B  advanceQueueRef.current = advanceQueue assignment exists',
  /advanceQueueRef\.current\s*=\s*advanceQueue\s*;/.test(src),
  'Expected: advanceQueueRef.current = advanceQueue;'
);

// 2.1-C: setInterval is used for playback (the mechanism exists, just has the bug for multi-word)
check(
  '2.1-C  setInterval is used for frame playback',
  /playbackTimerRef\.current\s*=\s*setInterval\s*\(/.test(src),
  'Expected: playbackTimerRef.current = setInterval('
);

// 2.1-D: Single-word path — playAction is called with a single action, which calls startPlayingFrames
// Verify playAction function exists AND calls startPlayingFrames inside it
check(
  '2.1-D  playAction useCallback is declared',
  /const\s+playAction\s*=\s*useCallback\s*\(/.test(src),
  'Expected: const playAction = useCallback('
);

// 2.1-E: startPlayingFrames is called inside playAction body
// The playAction async function body contains startPlayingFrames(...)
{
  // Extract from "const playAction = useCallback" to its closing "}," to confirm startPlayingFrames call
  const playActionMatch = src.match(/const\s+playAction\s*=\s*useCallback\s*\(\s*async[\s\S]*?},\s*\[(?:[^\]]*)\]\s*\)/);
  const hasStartPlaying = playActionMatch && /startPlayingFrames\s*\(/.test(playActionMatch[0]);
  check(
    '2.1-E  startPlayingFrames is called inside playAction body',
    !!hasStartPlaying,
    'Expected: startPlayingFrames(...) called within the playAction useCallback body'
  );
}

// 2.1-F: playAction is invoked on the first queue item (single-word entry point)
check(
  '2.1-F  playAction is called on queue[0] / firstAction (single-word entry point)',
  /playAction\s*\(\s*(?:queue\[0\]|firstAction)\s*\)/.test(src),
  'Expected: playAction(queue[0]) or playAction(firstAction)'
);

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2.2 — Speed set before playback starts
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n── Task 2.2 · Speed set before playback starts ─────────────────────────────\n');

// 2.2-A: playbackSpeed useState exists with initialization
check(
  '2.2-A  const [playbackSpeed, setPlaybackSpeed] = useState exists',
  /const\s*\[\s*playbackSpeed\s*,\s*setPlaybackSpeed\s*\]\s*=\s*useState/.test(src),
  'Expected: const [playbackSpeed, setPlaybackSpeed] = useState'
);

// 2.2-B: intervalMs is computed from current playbackSpeed value inside startPlayingFrames
// The formula must appear as: const intervalMs = Math.round((1000 / 30) / playbackSpeed)
check(
  '2.2-B  intervalMs = Math.round((1000 / 30) / playbackSpeed) is present',
  /const\s+intervalMs\s*=\s*Math\.round\s*\(\s*\(\s*1000\s*\/\s*30\s*\)\s*\/\s*playbackSpeed\s*\)/.test(src),
  'Expected: const intervalMs = Math.round((1000 / 30) / playbackSpeed)'
);

// 2.2-C: intervalMs is computed INSIDE startPlayingFrames (not outside or after)
// Verify both the startPlayingFrames declaration and the intervalMs line are present,
// and that intervalMs appears between startPlayingFrames opening and its closing useCallback deps.
{
  const startIdx = src.indexOf('const startPlayingFrames = useCallback(');
  // Find the matching end of this useCallback block by locating the deps array closing
  const endMarker = '}, [playbackSpeed, smoothMotion, stopAllPlayback]);';
  const endIdx = src.indexOf(endMarker, startIdx);

  const insideBody = startIdx !== -1 && endIdx !== -1
    ? src.slice(startIdx, endIdx + endMarker.length)
    : '';

  const intervalMsInsideCallback = /const\s+intervalMs\s*=\s*Math\.round/.test(insideBody);

  check(
    '2.2-C  intervalMs is computed inside the startPlayingFrames useCallback body',
    intervalMsInsideCallback,
    'Expected intervalMs to be declared within the startPlayingFrames useCallback (before the deps array)'
  );
}

// 2.2-D: intervalMs is read from playbackSpeed closure variable (not a ref)
// This confirms that when speed is set BEFORE playback starts, the correct speed IS captured
// (the stale-closure bug only bites when speed changes MID-playback — pre-set speed is correct)
check(
  '2.2-D  playbackSpeed is in the startPlayingFrames useCallback dep array',
  /},\s*\[\s*playbackSpeed\s*,\s*smoothMotion\s*,\s*stopAllPlayback\s*\]\s*\)/.test(src),
  'Expected deps: [playbackSpeed, smoothMotion, stopAllPlayback]'
);

// 2.2-E: Speed buttons [0.5, 0.75, 1.0] exist in JSX
check(
  '2.2-E  Speed buttons [0.5, 0.75, 1.0] exist in JSX',
  /\[\s*0\.5\s*,\s*0\.75\s*,\s*1\.0\s*\]/.test(src),
  'Expected: [0.5, 0.75, 1.0].map(... in JSX'
);

// 2.2-F: setPlaybackSpeed is called on button click (wires the speed buttons to state)
check(
  '2.2-F  setPlaybackSpeed is called on button click',
  /onClick\s*=\s*\{\s*\(\s*\)\s*=>\s*setPlaybackSpeed\s*\(/.test(src),
  'Expected: onClick={() => setPlaybackSpeed(spd)'
);

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n────────────────────────────────────────────────────────────────────────────');
console.log(`  Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('\n  ✓ Baseline confirmed — all preservation checks pass on unfixed code.\n');
  process.exit(0);
} else {
  console.log('\n  ✗ Baseline NOT confirmed — one or more checks failed.\n');
  process.exit(1);
}
