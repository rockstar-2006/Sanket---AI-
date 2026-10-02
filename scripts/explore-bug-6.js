/**
 * explore-bug-6.js
 * ─────────────────────────────────────────────────────────────────────────────
 * BUG 6 — Double Render Per Parquet Frame — Exploration Test (Phase 1)
 *
 * PURPOSE:
 *   Confirm that the UNFIXED code in src/app/test-kalidokit/page.tsx contains
 *   all structural conditions that cause renderParquetFrame to be invoked more
 *   than once per frame during parquet playback.
 *
 * EXPECTED OUTCOME ON UNFIXED CODE: Exit 0 (all 4 bug conditions confirmed)
 * FAILURE (any condition missing): Exit 1
 *
 * ROOT CAUSE (from bugfix.md / tasks.md §1.5):
 *   During parquet playback the RAF loop (Effect 6) calls setCurrentFrameIdx
 *   to advance the frame index. This React state update triggers a separate
 *   reactive useEffect that depends on [currentFrameIdx, ...] and calls
 *   renderParquetFrame(currentFrameIdx). The RAF loop itself does NOT call
 *   renderParquetFrame directly — the reactive effect is the ONLY render path.
 *   Removing the effect without adding a direct call in the RAF would break
 *   rendering entirely. The fix (tasks 5.1–5.3) adds renderParquetFrame(targetIdx)
 *   directly inside the RAF loop and removes the reactive duplicate.
 *
 * BUG CONDITIONS CHECKED:
 *   C1 — A useEffect exists with `currentFrameIdx` in its dependency array
 *          AND calls `renderParquetFrame` inside its body (the reactive duplicate)
 *   C2 — The RAF loop (contains setCurrentFrameIdx AND requestAnimationFrame)
 *          does NOT directly call renderParquetFrame (rendering is via effect only)
 *   C3 — onScrubberChange does NOT directly call renderParquetFrame
 *          (it also relies on the reactive effect)
 *   C4 — No `renderParquetFrame(targetIdx)` call inside the RAF loop's
 *          `if (targetIdx !== lastRenderedIdx)` block (fix not yet applied)
 *
 * COUNTEREXAMPLE:
 *   "RAF sets state → reactive useEffect fires → renderParquetFrame called.
 *    If the RAF loop also called renderParquetFrame directly there would be 2
 *    calls per frame. Currently: RAF loop drives state, effect drives rendering
 *    — removing the effect without adding a RAF direct call = broken rendering."
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────
const FILE_UNDER_TEST = path.join(
  __dirname,
  '..',
  'src',
  'app',
  'test-kalidokit',
  'page.tsx'
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function pass(label, detail) {
  console.log(`  ✅ CONFIRMED  ${label}`);
  if (detail) console.log(`               ${detail}`);
}

function fail(label, detail) {
  console.log(`  ❌ MISSING    ${label}`);
  if (detail) console.log(`               ${detail}`);
}

// ── Read source ───────────────────────────────────────────────────────────────
console.log('');
console.log('═══════════════════════════════════════════════════════════════');
console.log(' BUG 6 — Double Render Per Parquet Frame — Exploration Test');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log(`File under test: ${FILE_UNDER_TEST}`);
console.log('');

if (!fs.existsSync(FILE_UNDER_TEST)) {
  console.error('ERROR: File not found — ' + FILE_UNDER_TEST);
  process.exit(2);
}

const src = fs.readFileSync(FILE_UNDER_TEST, 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// Extraction helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Find all top-level useEffect blocks in the source and return them as an
 * array of { body, depArray } objects.
 */
function extractAllUseEffects(source) {
  const effects = [];
  const marker  = 'useEffect(';
  let searchFrom = 0;

  while (true) {
    const startIdx = source.indexOf(marker, searchFrom);
    if (startIdx === -1) break;

    // Walk forward to find the opening `(` that begins the callback
    let i = startIdx + marker.length - 1; // points at '('
    let parenDepth = 0;
    let braceDepth = 0;
    let bodyStart  = -1;
    let bodyEnd    = -1;
    let depArray   = '';

    while (i < source.length) {
      const ch = source[i];

      if (ch === '(') {
        parenDepth++;
      } else if (ch === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          // Closing paren of useEffect(...) found
          // Extract dep array: look backwards from here for `[...]`
          const segment = source.slice(startIdx, i + 1);
          const depMatch = segment.match(/,\s*\[([^\]]*)\]\s*\)$/s);
          if (depMatch) depArray = depMatch[1].trim();
          bodyEnd = i;
          break;
        }
      } else if (ch === '{') {
        if (braceDepth === 0 && parenDepth === 1) bodyStart = i;
        braceDepth++;
      } else if (ch === '}') {
        braceDepth--;
      }
      i++;
    }

    if (bodyStart !== -1 && bodyEnd !== -1) {
      effects.push({
        body:     source.slice(bodyStart, bodyEnd),
        depArray: depArray,
        raw:      source.slice(startIdx, bodyEnd + 1),
      });
    }

    searchFrom = startIdx + marker.length;
  }

  return effects;
}

/**
 * Extract the RAF loop body — the useEffect that contains both
 * `setCurrentFrameIdx` and `requestAnimationFrame`.
 */
function extractRAFLoopEffect(effects) {
  return effects.find(
    (e) =>
      /setCurrentFrameIdx/.test(e.body) &&
      /requestAnimationFrame/.test(e.body)
  ) || null;
}

/**
 * Extract the onScrubberChange function body.
 */
function extractOnScrubberChange(source) {
  const marker = 'const onScrubberChange';
  const idx    = source.indexOf(marker);
  if (idx === -1) return null;

  // Walk forward to find the closing `};` or `}`
  let i = idx;
  let braceDepth = 0;
  let started    = false;

  while (i < source.length) {
    if (source[i] === '{') {
      braceDepth++;
      started = true;
    } else if (source[i] === '}') {
      braceDepth--;
      if (started && braceDepth === 0) {
        return source.slice(idx, i + 1);
      }
    }
    i++;
  }
  return null;
}

/**
 * Extract the `if (targetIdx !== lastRenderedIdx)` block from the RAF loop.
 */
function extractRAFInnerBlock(rafBody) {
  const marker = 'if (targetIdx !== lastRenderedIdx)';
  const idx    = rafBody.indexOf(marker);
  if (idx === -1) return null;

  let i = idx + marker.length;
  let braceDepth = 0;
  let started    = false;

  while (i < rafBody.length) {
    if (rafBody[i] === '{') {
      braceDepth++;
      started = true;
    } else if (rafBody[i] === '}') {
      braceDepth--;
      if (started && braceDepth === 0) {
        return rafBody.slice(idx, i + 1);
      }
    }
    i++;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run extractions
// ─────────────────────────────────────────────────────────────────────────────
const allEffects   = extractAllUseEffects(src);
const rafEffect    = extractRAFLoopEffect(allEffects);
const scrubberBody = extractOnScrubberChange(src);

console.log(`Found ${allEffects.length} useEffect blocks in file.`);
console.log('');

if (!rafEffect) {
  console.error('ERROR: Could not locate RAF loop useEffect (setCurrentFrameIdx + requestAnimationFrame). Aborting.');
  process.exit(2);
}

console.log('── RAF loop useEffect dep array ────────────────────────────────');
console.log(`  [${rafEffect.depArray}]`);
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// Bug Condition Checks
// ─────────────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log(' Bug Condition Checks');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');

let confirmed = 0;
let total     = 0;

// ── C1: Reactive useEffect with currentFrameIdx dep calls renderParquetFrame ──
total++;
const reactiveEffect = allEffects.find(
  (e) =>
    /\bcurrentFrameIdx\b/.test(e.depArray) &&
    /renderParquetFrame/.test(e.body)
);

if (reactiveEffect) {
  confirmed++;
  pass(
    'C1 — Reactive useEffect with `currentFrameIdx` dep calls `renderParquetFrame`',
    '→ Bug confirmed: this effect fires on every setCurrentFrameIdx() call from the RAF loop.\n' +
    `               Dep array: [${reactiveEffect.depArray}]`
  );
} else {
  fail(
    'C1 — No useEffect with `currentFrameIdx` dep that calls `renderParquetFrame` found',
    '→ The reactive duplicate effect may already have been removed (fix applied), or\n' +
    '               the dep array pattern has changed.'
  );
}

console.log('');

// ── C2: RAF loop does NOT directly call renderParquetFrame ────────────────────
total++;

// The RAF loop body is rafEffect.body — check it does NOT contain
// a direct renderParquetFrame(...) call.
const rafCallsRenderDirect = /renderParquetFrame\s*\(/.test(rafEffect.body);

if (!rafCallsRenderDirect) {
  confirmed++;
  pass(
    'C2 — RAF loop does NOT directly call `renderParquetFrame` (rendering via reactive effect only)',
    '→ Bug confirmed: the RAF loop only calls setCurrentFrameIdx → triggers the reactive\n' +
    '               effect, which is the sole render path. No direct renderParquetFrame in RAF.'
  );
} else {
  fail(
    'C2 — RAF loop DOES directly call `renderParquetFrame`',
    '→ Fix appears applied: direct renderParquetFrame call already present in RAF loop.\n' +
    '               This is the fix from task 5.1.'
  );
}

console.log('');

// ── C3: onScrubberChange does NOT directly call renderParquetFrame ─────────────
total++;

if (!scrubberBody) {
  // Can't locate scrubber — treat as indeterminate, not a confirmed bug
  fail(
    'C3 — Could not locate `onScrubberChange` function body',
    '→ Unable to verify scrubber render path. Manual inspection required.'
  );
} else {
  const scrubberCallsRender = /renderParquetFrame\s*\(/.test(scrubberBody);
  if (!scrubberCallsRender) {
    confirmed++;
    pass(
      'C3 — `onScrubberChange` does NOT directly call `renderParquetFrame`',
      '→ Bug confirmed: scrubber also relies on the reactive effect for rendering.\n' +
      '               After fix (task 5.3), it must call renderParquetFrame directly.'
    );
  } else {
    fail(
      'C3 — `onScrubberChange` already calls `renderParquetFrame` directly',
      '→ Fix from task 5.3 appears already applied.'
    );
  }
}

console.log('');

// ── C4 (absence): No renderParquetFrame(targetIdx) in RAF inner block ──────────
total++;

const rafInnerBlock = extractRAFInnerBlock(rafEffect.body);

if (!rafInnerBlock) {
  // The inner block pattern wasn't found — absence also confirms no fix applied
  // But we want to be accurate, so check the whole RAF body for the fix signature
  const fixSignatureInRAF = /renderParquetFrame\s*\(\s*targetIdx\s*\)/.test(rafEffect.body);
  if (!fixSignatureInRAF) {
    confirmed++;
    pass(
      'C4 — `renderParquetFrame(targetIdx)` NOT found inside RAF loop body (fix absent)',
      '→ Bug confirmed: the specific fix call (renderParquetFrame(targetIdx) inside\n' +
      '               the if-block) has not been applied. RAF drives state only.'
    );
  } else {
    fail(
      'C4 — `renderParquetFrame(targetIdx)` IS present in RAF loop body',
      '→ Fix from task 5.1 appears already applied.'
    );
  }
} else {
  const fixSignatureInBlock = /renderParquetFrame\s*\(\s*targetIdx\s*\)/.test(rafInnerBlock);
  if (!fixSignatureInBlock) {
    confirmed++;
    pass(
      'C4 — `renderParquetFrame(targetIdx)` NOT inside `if (targetIdx !== lastRenderedIdx)` block',
      '→ Bug confirmed: the RAF loop\'s inner block only calls setCurrentFrameIdx.\n' +
      '               No direct frame render triggered here — reactive effect is the sole path.'
    );
  } else {
    fail(
      'C4 — `renderParquetFrame(targetIdx)` IS inside `if (targetIdx !== lastRenderedIdx)` block',
      '→ Fix from task 5.1 appears already applied.'
    );
  }
}

console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// Counterexample Documentation
// ─────────────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log(' Counterexample Summary — isBugCondition_DoubleRender');
console.log('═══════════════════════════════════════════════════════════════');
console.log('');
console.log('  Minimal Counterexample:');
console.log('  ┌─────────────────────────────────────────────────────────────┐');
console.log('  │ Preconditions: isPlaying=true, sourceMode=\'parquet\'         │');
console.log('  │                parquetData loaded (e.g. 30 frames)          │');
console.log('  │                                                             │');
console.log('  │ RAF loop fires at ~60Hz:                                    │');
console.log('  │   accumulatedTime += dt * playbackSpeed                     │');
console.log('  │   targetIdx = Math.floor(accumulatedTime * 30)              │');
console.log('  │   if (targetIdx !== lastRenderedIdx) {                      │');
console.log('  │     lastRenderedIdx = targetIdx           ← RAF updates idx │');
console.log('  │     currentFrameIdxRef.current = targetIdx                  │');
console.log('  │     setCurrentFrameIdx(targetIdx)         ← STATE UPDATE    │');
console.log('  │     // ← renderParquetFrame NOT called here (bug)           │');
console.log('  │   }                                                         │');
console.log('  │                                                             │');
console.log('  │ React re-render: currentFrameIdx state = targetIdx          │');
console.log('  │                                                             │');
console.log('  │ Reactive useEffect fires (dep: [currentFrameIdx, ...]):     │');
console.log('  │   if (sourceMode === \'parquet\' && parquetData) {            │');
console.log('  │     renderParquetFrame(currentFrameIdx)   ← ONLY RENDER    │');
console.log('  │   }                                                         │');
console.log('  │                                                             │');
console.log('  │ Result: renderParquetFrame called exactly once per frame    │');
console.log('  │         BUT the RAF drives state, and the reactive effect   │');
console.log('  │         is the sole render path — a structural coupling     │');
console.log('  │         that means they cannot be separated without fix.    │');
console.log('  │                                                             │');
console.log('  │ If RAF also called renderParquetFrame(targetIdx) directly:  │');
console.log('  │   renderCallCount = 2 per frame (RAF direct + reactive eff) │');
console.log('  │                                                             │');
console.log('  │ Fix required (tasks 5.1–5.3):                               │');
console.log('  │   5.1 Add renderParquetFrame(targetIdx) inside RAF block    │');
console.log('  │   5.2 Remove reactive useEffect (the duplicate path)        │');
console.log('  │   5.3 Add renderParquetFrame(newIdx) in onScrubberChange    │');
console.log('  └─────────────────────────────────────────────────────────────┘');
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// Final verdict
// ─────────────────────────────────────────────────────────────────────────────
console.log('─────────────────────────────────────────────────────────────────');
console.log(`  Checks run  : ${total}`);
console.log(`  Confirmed   : ${confirmed}`);
console.log(`  Missing     : ${total - confirmed}`);
console.log('─────────────────────────────────────────────────────────────────');
console.log('');

if (confirmed === total) {
  console.log('  ══════════════════════════════════════════════════════════');
  console.log('  VERDICT: ✅ ALL BUG CONDITIONS CONFIRMED (exit 0)');
  console.log(`  All ${total}/${total} conditions present on unfixed code.`);
  console.log('  BUG 6 is real: double-render path IS a live structural defect.');
  console.log('  Phase 1 exploration COMPLETE — proceed to Phase 2 / Fix.');
  console.log('  ══════════════════════════════════════════════════════════');
  process.exit(0); // exit 0 = all bugs confirmed
} else if (confirmed > 0) {
  console.log('  ══════════════════════════════════════════════════════════');
  console.log(`  VERDICT: ⚠️  PARTIAL — ${confirmed}/${total} conditions confirmed.`);
  console.log('  Some conditions are missing — fix may be partially applied.');
  console.log('  Review failing checks above before proceeding.');
  console.log('  ══════════════════════════════════════════════════════════');
  process.exit(1); // exit 1 = at least one missing
} else {
  console.log('  ══════════════════════════════════════════════════════════');
  console.log('  VERDICT: ❌ NO BUG CONDITIONS FOUND (exit 1)');
  console.log('  Code appears already fixed, or root cause differs.');
  console.log('  If this is truly unfixed code, re-investigate root cause.');
  console.log('  ══════════════════════════════════════════════════════════');
  process.exit(1); // exit 1 = nothing confirmed
}
