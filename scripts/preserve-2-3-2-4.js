#!/usr/bin/env node
/**
 * Preservation Baseline Checks — Tasks 2.3 and 2.4
 *
 * Task 2.3: Right hand detachment threshold unchanged (0.28)
 * Task 2.4: MOV mode unaffected in test-kalidokit
 *
 * Exit 0 = all checks PASS (baseline confirmed)
 * Exit 1 = one or more checks FAIL (baseline broken)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function check(label, condition, detail) {
  if (condition) {
    console.log(`  ✅  PASS: ${label}`);
    if (detail) console.log(`        ${detail}`);
    passed++;
  } else {
    console.error(`  ❌  FAIL: ${label}`);
    if (detail) console.error(`        ${detail}`);
    failed++;
  }
}

// ─── READ SOURCE FILES ───────────────────────────────────────────────────────

const skeletonPath = path.join(ROOT, 'src/lib/holographic3DSkeleton.ts');
const kalidokitPath = path.join(ROOT, 'src/app/test-kalidokit/page.tsx');

let skeletonSrc, kalidokitSrc;

try {
  skeletonSrc = fs.readFileSync(skeletonPath, 'utf8');
} catch (e) {
  console.error(`Cannot read ${skeletonPath}: ${e.message}`);
  process.exit(1);
}

try {
  kalidokitSrc = fs.readFileSync(kalidokitPath, 'utf8');
} catch (e) {
  console.error(`Cannot read ${kalidokitPath}: ${e.message}`);
  process.exit(1);
}

const skeletonLines = skeletonSrc.split('\n');
const kalidokitLines = kalidokitSrc.split('\n');

// ─── TASK 2.3 — Right hand detachment threshold unchanged (0.28) ─────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TASK 2.3 — Right hand detachment threshold unchanged (0.28)');
console.log('File: src/lib/holographic3DSkeleton.ts');
console.log('═══════════════════════════════════════════════════════════════\n');

// Check 2.3.1: `dist2DR > 0.28` exists somewhere in the file
const rightHandThresholdExists = /dist2DR\s*>\s*0\.28/.test(skeletonSrc);
check(
  'dist2DR > 0.28 exists in file',
  rightHandThresholdExists,
  rightHandThresholdExists
    ? 'Right-hand threshold line found'
    : 'Could not find "dist2DR > 0.28" anywhere in holographic3DSkeleton.ts'
);

// Check 2.3.2: dist2DR > 0.28 is INSIDE the right hand block (after "Right Hand" comment, before "Left Hand" comment)
// Use the numbered runtime processing section headers (e.g. "3. Right Hand", "4. Left Hand")
// to avoid matching the build-time "Build Right Hand" / "Build Left Hand" headers.
const rightHandSectionIdx = skeletonLines.findIndex(l => /3\.\s*Right Hand/.test(l) && /─/.test(l));
const leftHandSectionIdx  = skeletonLines.findIndex((l, i) => i > rightHandSectionIdx && /4\.\s*Left Hand/.test(l) && /─/.test(l));
const rightThresholdLineIdx = skeletonLines.findIndex(l => /dist2DR\s*>\s*0\.28/.test(l));

const rightThresholdInRightBlock =
  rightHandSectionIdx !== -1 &&
  leftHandSectionIdx  !== -1 &&
  rightThresholdLineIdx !== -1 &&
  rightThresholdLineIdx > rightHandSectionIdx &&
  rightThresholdLineIdx < leftHandSectionIdx;

check(
  'dist2DR > 0.28 is inside the right hand processing block',
  rightThresholdInRightBlock,
  rightThresholdInRightBlock
    ? `Right-hand section starts at line ${rightHandSectionIdx + 1}, ` +
      `threshold at line ${rightThresholdLineIdx + 1}, ` +
      `left-hand section starts at line ${leftHandSectionIdx + 1}`
    : `rightHandSection=${rightHandSectionIdx + 1}, ` +
      `leftHandSection=${leftHandSectionIdx + 1}, ` +
      `thresholdLine=${rightThresholdLineIdx + 1} — expected threshold between the two section lines`
);

// Check 2.3.3: Left hand threshold `wristDistL > 0.18` exists separately
const leftHandThresholdExists = /wristDistL\s*>\s*0\.18/.test(skeletonSrc);
check(
  'wristDistL > 0.18 exists in file (left hand threshold)',
  leftHandThresholdExists,
  leftHandThresholdExists
    ? 'Left-hand threshold line found'
    : 'Could not find "wristDistL > 0.18" in holographic3DSkeleton.ts'
);

// Check 2.3.4: The two thresholds are on SEPARATE lines in SEPARATE code paths
//   - right threshold line uses dist2DR
//   - left threshold line uses wristDistL
//   - they must not be on the same line
const leftThresholdLineIdx = skeletonLines.findIndex(l => /wristDistL\s*>\s*0\.18/.test(l));

const thresholdsOnSeparateLines =
  rightThresholdLineIdx !== -1 &&
  leftThresholdLineIdx  !== -1 &&
  rightThresholdLineIdx !== leftThresholdLineIdx;

check(
  'Right (dist2DR > 0.28) and left (wristDistL > 0.18) thresholds are on separate lines',
  thresholdsOnSeparateLines,
  thresholdsOnSeparateLines
    ? `Right threshold: line ${rightThresholdLineIdx + 1}, Left threshold: line ${leftThresholdLineIdx + 1}`
    : `Both thresholds found on the same line or one is missing`
);

// Check 2.3.5: Left threshold is in the LEFT hand block (after left hand section header)
const leftThresholdInLeftBlock =
  leftHandSectionIdx !== -1 &&
  leftThresholdLineIdx !== -1 &&
  leftThresholdLineIdx > leftHandSectionIdx;

check(
  'wristDistL > 0.18 is inside the left hand processing block',
  leftThresholdInLeftBlock,
  leftThresholdInLeftBlock
    ? `Left-hand section starts at line ${leftHandSectionIdx + 1}, threshold at line ${leftThresholdLineIdx + 1}`
    : `Left-hand threshold (line ${leftThresholdLineIdx + 1}) not found after left-hand section (line ${leftHandSectionIdx + 1})`
);

// ─── TASK 2.4 — MOV mode unaffected in test-kalidokit ───────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('TASK 2.4 — MOV mode unaffected in test-kalidokit');
console.log('File: src/app/test-kalidokit/page.tsx');
console.log('═══════════════════════════════════════════════════════════════\n');

// Check 2.4.1: `sourceMode === 'mov'` appears in the codebase (MOV mode exists)
const movModeExists = /sourceMode\s*===\s*'mov'/.test(kalidokitSrc);
check(
  "sourceMode === 'mov' appears in test-kalidokit (MOV mode exists)",
  movModeExists,
  movModeExists
    ? "MOV mode guard found"
    : "Could not find sourceMode === 'mov' in test-kalidokit/page.tsx"
);

// Check 2.4.2: `sourceMode !== 'parquet'` or `sourceMode === 'mov'` guards separate the MOV path from parquet path
const movGuardExists =
  /sourceMode\s*!==\s*'parquet'/.test(kalidokitSrc) ||
  /sourceMode\s*===\s*'mov'/.test(kalidokitSrc);

check(
  "sourceMode !== 'parquet' or sourceMode === 'mov' guards exist to separate MOV path from parquet path",
  movGuardExists,
  movGuardExists
    ? 'MOV/parquet separation guard found'
    : "No guard separating MOV from parquet path found"
);

// Check 2.4.3: The RAF loop that calls `setCurrentFrameIdx` only runs when `sourceMode === 'parquet'`
// Find the parquet playback useEffect — it should guard with sourceMode !== 'parquet' early return
// The loop is Effect 6; it contains setCurrentFrameIdx(targetIdx) and has sourceMode in deps.
// We check that the body of that effect starts with a guard checking sourceMode !== 'parquet'

// Locate the Effect 6 block: find line with setCurrentFrameIdx(targetIdx) inside a RAF loop
const setCurrentFrameIdxInLoopLineIdx = kalidokitLines.findIndex(l =>
  /setCurrentFrameIdx\s*\(\s*targetIdx\s*\)/.test(l)
);

// Find the enclosing useEffect — search backward from the setCurrentFrameIdx line
let effect6StartIdx = -1;
for (let i = setCurrentFrameIdxInLoopLineIdx; i >= 0; i--) {
  if (/useEffect\s*\(/.test(kalidokitLines[i])) {
    effect6StartIdx = i;
    break;
  }
}

// The first substantive line after useEffect(() => { should be the parquet guard
// Search forward from effect6StartIdx for the guard pattern
let parquetGuardFoundInRAFEffect = false;
if (effect6StartIdx !== -1) {
  for (let i = effect6StartIdx; i < Math.min(effect6StartIdx + 5, kalidokitLines.length); i++) {
    if (/sourceMode\s*!==\s*'parquet'/.test(kalidokitLines[i])) {
      parquetGuardFoundInRAFEffect = true;
      break;
    }
  }
}

check(
  "RAF loop (Effect 6) that calls setCurrentFrameIdx only runs when sourceMode === 'parquet'",
  parquetGuardFoundInRAFEffect,
  parquetGuardFoundInRAFEffect
    ? `Guard found near line ${effect6StartIdx + 1}`
    : `Could not find 'sourceMode !== parquet' guard within 5 lines of the RAF loop useEffect at line ${effect6StartIdx + 1}`
);

// Check 2.4.4: The RAF loop deps array contains `sourceMode` (confirms it re-evaluates on mode change)
let rafEffectDepsContainsSourceMode = false;
if (effect6StartIdx !== -1) {
  // Find the closing deps array of this useEffect — search for ], [...sourceMode...]
  for (let i = effect6StartIdx; i < Math.min(effect6StartIdx + 50, kalidokitLines.length); i++) {
    if (/\[\s*sourceMode/.test(kalidokitLines[i]) || /sourceMode[^\]]*\]/.test(kalidokitLines[i])) {
      rafEffectDepsContainsSourceMode = true;
      break;
    }
  }
}

check(
  'RAF loop useEffect dependency array contains sourceMode (re-runs when mode changes)',
  rafEffectDepsContainsSourceMode,
  rafEffectDepsContainsSourceMode
    ? 'sourceMode found in RAF loop useEffect deps'
    : 'sourceMode NOT found in deps array of RAF loop useEffect'
);

// Check 2.4.5: The MediaPipe Holistic processing useEffect depends on `sourceMode` and `isPlaying`
//   (Effect 8: "Continuous MOV Video Processing Loop")
// Find Effect 8 by locating the useEffect whose deps contain [sourceMode, isPlaying] and body contains sourceMode !== 'mov'
const movProcessingEffectLine = kalidokitLines.findIndex(l =>
  /sourceMode\s*!==\s*'mov'\s*\|\|\s*!isPlaying/.test(l) ||
  /sourceMode\s*!==\s*'mov'/.test(l) && l.includes('isPlaying')
);

// Find the useEffect that owns this line (search backwards)
let movEffectStartIdx = -1;
for (let i = movProcessingEffectLine; i >= 0; i--) {
  if (/useEffect\s*\(/.test(kalidokitLines[i])) {
    movEffectStartIdx = i;
    break;
  }
}

// Check its deps contain sourceMode and isPlaying
let movEffectDepsCorrect = false;
if (movEffectStartIdx !== -1) {
  for (let i = movEffectStartIdx; i < Math.min(movEffectStartIdx + 50, kalidokitLines.length); i++) {
    const line = kalidokitLines[i];
    if (/\[/.test(line) && /sourceMode/.test(line) && /isPlaying/.test(line)) {
      movEffectDepsCorrect = true;
      break;
    }
  }
}

check(
  'MediaPipe Holistic useEffect (MOV processing loop) depends on [sourceMode, isPlaying]',
  movEffectDepsCorrect,
  movEffectDepsCorrect
    ? `MOV processing useEffect found at line ${movEffectStartIdx + 1} with correct deps`
    : `Could not confirm [sourceMode, isPlaying] deps on MOV processing useEffect (found useEffect at line ${movEffectStartIdx + 1})`
);

// Check 2.4.6: MOV processing effect is SEPARATE from the parquet RAF effect
//   i.e., the two useEffect blocks are different (different line numbers)
const effectsAreSeparate = effect6StartIdx !== -1 && movEffectStartIdx !== -1 && effect6StartIdx !== movEffectStartIdx;
check(
  'Parquet RAF useEffect and MediaPipe Holistic MOV useEffect are separate blocks',
  effectsAreSeparate,
  effectsAreSeparate
    ? `Parquet RAF at line ${effect6StartIdx + 1}, MOV processing at line ${movEffectStartIdx + 1}`
    : `Could not confirm the two effects are separate`
);

// ─── SUMMARY ─────────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (failed > 0) {
  console.error(`Baseline BROKEN — ${failed} check(s) failed. Fix the issues above before proceeding with fixes.`);
  process.exit(1);
} else {
  console.log('Baseline CONFIRMED — all checks pass. Safe to proceed with implementing fixes.');
  process.exit(0);
}
