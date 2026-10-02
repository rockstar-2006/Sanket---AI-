/**
 * BUG 5 Exploration Test — Left Hand Threshold Asymmetry
 *
 * Phase 1: Exploration (UNFIXED code)
 * File under test: src/lib/holographic3DSkeleton.ts
 *
 * Bug condition: Left hand uses `wristDistL > 0.18` while right hand uses `dist2DR > 0.28`.
 * This causes the left hand to be hidden at distances in range (0.18, 0.28], which are
 * perfectly valid hand positions that the right hand would keep visible.
 *
 * Expected outcome on UNFIXED code: EXIT 0 (all bug conditions confirmed)
 * If this exits 1, the bug has already been fixed or the source pattern changed.
 */

const fs = require('fs');
const path = require('path');

// ─── Colours for terminal output ───────────────────────────────────────────
const RED    = '\x1b[31m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const PASS = `${GREEN}✓ PASS${RESET}`;
const FAIL = `${RED}✗ FAIL${RESET}`;

console.log(`\n${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}`);
console.log(`${BOLD}  BUG 5 — Left Hand Threshold Asymmetry  |  Phase 1 Exploration${RESET}`);
console.log(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}\n`);

// ─── Part A: Static Source Analysis ────────────────────────────────────────
console.log(`${BOLD}Part A: Static source analysis of holographic3DSkeleton.ts${RESET}`);
console.log('─'.repeat(62));

const sourceFile = path.join(__dirname, '..', 'src', 'lib', 'holographic3DSkeleton.ts');

let source;
try {
  source = fs.readFileSync(sourceFile, 'utf8');
} catch (err) {
  console.error(`${RED}ERROR: Cannot read source file: ${sourceFile}${RESET}`);
  console.error(err.message);
  process.exit(1);
}

let allPassed = true;

/**
 * Run a single check, log result, update overall pass flag.
 */
function check(id, description, condition, extraInfo = '') {
  const ok = !!condition;
  if (!ok) allPassed = false;
  const badge = ok ? PASS : FAIL;
  console.log(`  ${badge}  [${id}] ${description}`);
  if (extraInfo) {
    console.log(`         ${YELLOW}→ ${extraInfo}${RESET}`);
  }
}

// C1 — Left hand uses the buggy threshold 0.18
const leftThresholdMatch = source.match(/wristDistL\s*>\s*([\d.]+)/);
const leftThresholdValue = leftThresholdMatch ? parseFloat(leftThresholdMatch[1]) : null;
check(
  'C1',
  'Left hand threshold `wristDistL > 0.18` exists (the bug)',
  leftThresholdValue === 0.18,
  leftThresholdValue !== null
    ? `Found: wristDistL > ${leftThresholdValue}`
    : 'Pattern wristDistL > <number> NOT found'
);

// C2 — Right hand uses the reference threshold 0.28
const rightThresholdMatch = source.match(/dist2DR\s*>\s*([\d.]+)/);
const rightThresholdValue = rightThresholdMatch ? parseFloat(rightThresholdMatch[1]) : null;
check(
  'C2',
  'Right hand threshold `dist2DR > 0.28` exists (the reference)',
  rightThresholdValue === 0.28,
  rightThresholdValue !== null
    ? `Found: dist2DR > ${rightThresholdValue}`
    : 'Pattern dist2DR > <number> NOT found'
);

// C3 — The two thresholds are different (asymmetry confirmed)
check(
  'C3',
  'The two thresholds are DIFFERENT (asymmetry confirmed)',
  leftThresholdValue !== null && rightThresholdValue !== null && leftThresholdValue !== rightThresholdValue,
  leftThresholdValue !== null && rightThresholdValue !== null
    ? `left=${leftThresholdValue}  right=${rightThresholdValue}  asymmetric=${leftThresholdValue !== rightThresholdValue}`
    : 'One or both threshold values could not be extracted'
);

// C4 — Left threshold is LESS THAN right threshold (left hand disappears sooner)
check(
  'C4',
  'Left threshold < right threshold (left hand disappears at shorter distance)',
  leftThresholdValue !== null && rightThresholdValue !== null && leftThresholdValue < rightThresholdValue,
  leftThresholdValue !== null && rightThresholdValue !== null
    ? `${leftThresholdValue} < ${rightThresholdValue} = ${leftThresholdValue < rightThresholdValue}`
    : 'Cannot compare — value extraction failed'
);

// C5 — The left hand block does NOT yet use 0.28 (fix not applied)
// Strategy: locate the left hand detachment block and confirm it doesn't reference 0.28
// The left hand block is identified by the comment "Physical detachment check" near "wristDistL"
// We find the block between the "Left Hand" section and the next major section.
const leftHandSectionStart = source.indexOf('4. Left Hand (Emerald)');
const leftHandDetachBlock  = leftHandSectionStart !== -1
  ? source.slice(leftHandSectionStart, leftHandSectionStart + 800)
  : null;

const leftBlockHas028 = leftHandDetachBlock ? />\s*0\.28/.test(leftHandDetachBlock) : false;

check(
  'C5',
  '`> 0.28` does NOT appear in the left hand detachment block (fix not yet applied)',
  !leftBlockHas028,
  leftBlockHas028
    ? `Found > 0.28 in left hand block — fix may already be applied!`
    : `Confirmed: left hand block still uses ${leftThresholdValue}, not 0.28`
);

// ─── Part B: Programmatic Unit-Style Threshold Checks ──────────────────────
console.log(`\n${BOLD}Part B: Programmatic threshold evaluation — synthetic wristDist cases${RESET}`);
console.log('─'.repeat(62));

const LEFT_THRESHOLD  = 0.18;  // ← current buggy value
const RIGHT_THRESHOLD = 0.28;  // ← correct / reference value

const testCases = [
  { dist: 0.15, label: 'near (normal ISL sign position)' },
  { dist: 0.22, label: 'mid-range (body-cross ISL position) ← THE COUNTEREXAMPLE' },
  { dist: 0.30, label: 'far (genuinely detached)' },
];

console.log(`\n  ${'dist'.padEnd(6)} ${'handValidL (left, 0.18)'.padEnd(28)} ${'handValidR equiv (0.28)'.padEnd(28)} ${'Result'}`);
console.log(`  ${'──────'.padEnd(6)} ${'────────────────────────────'.padEnd(28)} ${'────────────────────────────'.padEnd(28)} ──────────────`);

let counterexampleConfirmed = false;

for (const { dist, label } of testCases) {
  const hiddenUnderLeft  = dist > LEFT_THRESHOLD;   // true = hand hidden (current buggy behaviour)
  const hiddenUnderRight = dist > RIGHT_THRESHOLD;  // true = hand hidden (correct / right-hand logic)

  const leftStr  = hiddenUnderLeft  ? `${RED}HIDDEN (dist>${LEFT_THRESHOLD})${RESET}` : `${GREEN}VISIBLE${RESET}          `;
  const rightStr = hiddenUnderRight ? `${RED}HIDDEN (dist>${RIGHT_THRESHOLD})${RESET}` : `${GREEN}VISIBLE${RESET}          `;

  const isBugCase = hiddenUnderLeft && !hiddenUnderRight; // hidden by left threshold but should be visible
  const annotation = isBugCase ? `${RED}← BUG: should be VISIBLE${RESET}` : '';

  if (isBugCase) counterexampleConfirmed = true;

  console.log(`  ${String(dist).padEnd(6)} ${leftStr.padEnd(28)} ${rightStr.padEnd(28)} ${annotation}`);
  console.log(`         ${YELLOW}${label}${RESET}`);
}

console.log('');

check(
  'C6',
  'Counterexample confirmed: wristDistL=0.22 → handValidL=false (wrong under left threshold)',
  counterexampleConfirmed,
  counterexampleConfirmed
    ? 'wristDistL=0.22 > 0.18 → handValidL=false; but 0.22 ≤ 0.28, so right-hand equivalent would be VISIBLE'
    : 'Counterexample NOT produced — thresholds may have changed'
);

// ─── Part C: Counterexample Documentation ──────────────────────────────────
console.log(`\n${BOLD}Part C: Counterexample documentation${RESET}`);
console.log('─'.repeat(62));
console.log(`
  Counterexample:
    Input:  wristDistL = 0.22
            (distance between vJointsL[0] and vWristL in world-space)

    Under current code (LEFT threshold = 0.18):
      0.22 > 0.18  →  handValidL = false  →  left hand is HIDDEN  ✗

    Under fixed code  (LEFT threshold = 0.28, matching right hand):
      0.22 > 0.28  →  false               →  handValidL = true   →  left hand VISIBLE  ✓

    Under right-hand code (RIGHT threshold = 0.28, unchanged):
      dist2DR = 0.22 > 0.28  →  false     →  handValidR = true   →  right hand VISIBLE ✓

    Conclusion:
      At the same distance (0.22), the RIGHT hand renders correctly but the LEFT
      hand is falsely hidden — purely due to the lower threshold on the left side.
      This directly impacts ISL signs where the left hand crosses the body midline
      (e.g., pointing signs, bilateral signs), causing flickering / disappearing
      left-hand landmarks.
`);

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}`);
if (allPassed) {
  console.log(`${BOLD}${GREEN}  RESULT: ALL BUG CONDITIONS CONFIRMED — Bug 5 exists in source${RESET}`);
  console.log(`${GREEN}  Exit 0 — exploration test PASSED (bug presence verified)${RESET}`);
} else {
  console.log(`${BOLD}${RED}  RESULT: ONE OR MORE CHECKS FAILED${RESET}`);
  console.log(`${RED}  Exit 1 — check output above for details${RESET}`);
}
console.log(`${BOLD}${CYAN}══════════════════════════════════════════════════════════════${RESET}\n`);

process.exit(allPassed ? 0 : 1);
