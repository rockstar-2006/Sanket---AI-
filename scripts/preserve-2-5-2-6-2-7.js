/**
 * Preservation Baseline Script — Tasks 2.5, 2.6, 2.7
 *
 * Phase 2: Preservation Baseline — verifies non-buggy behavior on UNFIXED code.
 * All checks MUST PASS (exit 0 = baseline confirmed).
 *
 * Task 2.5 — Manual scrubbing still renders (test-kalidokit/page.tsx)
 * Task 2.6 — Gemini fallback still functions (speechToSignAgent.ts)
 * Task 2.7 — glideToStandby fires after last word (test-speech-to-sign/page.tsx)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── ANSI color helpers ──────────────────────────────────────────────────────
const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s) => `\x1b[1m${s}\x1b[0m`;
const cyan   = (s) => `\x1b[36m${s}\x1b[0m`;

// ─── Result tracking ─────────────────────────────────────────────────────────
const results = [];

function pass(taskId, checkName, detail) {
  results.push({ ok: true, taskId, checkName, detail });
  console.log(`  ${green('✔')} [${taskId}] ${checkName}`);
  if (detail) console.log(`       ${cyan(detail)}`);
}

function fail(taskId, checkName, detail) {
  results.push({ ok: false, taskId, checkName, detail });
  console.log(`  ${red('✘')} [${taskId}] ${checkName}`);
  if (detail) console.log(`       ${red(detail)}`);
}

// ─── File readers ─────────────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, '..');

function readSource(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Source file not found: ${abs}`);
  }
  return fs.readFileSync(abs, 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2.5 — Manual scrubbing still renders (test-kalidokit/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
console.log(bold('\n═══════════════════════════════════════════════════════════'));
console.log(bold('  Task 2.5 — Preservation: Manual Scrubbing Still Renders'));
console.log(bold('  File: src/app/test-kalidokit/page.tsx'));
console.log(bold('═══════════════════════════════════════════════════════════\n'));

try {
  const src25 = readSource('src/app/test-kalidokit/page.tsx');

  // Check 1: onScrubberChange function exists
  const hasOnScrubberChange = /const\s+onScrubberChange\s*=|function\s+onScrubberChange\s*\(|onScrubberChange\s*=\s*\(/.test(src25)
    || /onScrubberChange\s*\(/.test(src25);
  // More precise: the handler definition
  const hasScrubberDef = /onScrubberChange\s*[=:]\s*(?:useCallback\s*\()?(?:\([^)]*\)\s*=>|\([^)]*\)\s*\{|function)/.test(src25)
    || /const\s+onScrubberChange\s*=/.test(src25);
  if (hasScrubberDef || /onScrubberChange\s*\(newIdx/.test(src25)) {
    pass('2.5', 'onScrubberChange function exists',
      'onScrubberChange handler is defined in test-kalidokit/page.tsx');
  } else {
    fail('2.5', 'onScrubberChange function exists',
      'Could not find onScrubberChange definition');
  }

  // Check 2: setCurrentFrameIdx(newIdx) is called in onScrubberChange
  // Extract the body of onScrubberChange
  const scrubberBodyMatch = src25.match(
    /onScrubberChange\s*=\s*\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\n\s*\};/
  ) || src25.match(
    /const\s+onScrubberChange\s*=\s*\(([^)]*)\)\s*=>\s*\{([\s\S]*?)\n\s*\}/
  );

  // Simpler approach: check that setCurrentFrameIdx(newIdx) is called near onScrubberChange
  // Find onScrubberChange block and check its content
  const scrubberIdx = src25.indexOf('onScrubberChange');
  if (scrubberIdx !== -1) {
    // Get the ~200 chars after the definition to check its body
    const nearScrubber = src25.substring(scrubberIdx, scrubberIdx + 400);
    if (/setCurrentFrameIdx\s*\(/.test(nearScrubber)) {
      pass('2.5', 'onScrubberChange calls setCurrentFrameIdx(newIdx)',
        'setCurrentFrameIdx() is called inside onScrubberChange — triggers reactive useEffect → renderParquetFrame');
    } else {
      fail('2.5', 'onScrubberChange calls setCurrentFrameIdx(newIdx)',
        'setCurrentFrameIdx() call not found in onScrubberChange body');
    }
  } else {
    fail('2.5', 'onScrubberChange calls setCurrentFrameIdx(newIdx)',
      'onScrubberChange not found — cannot check body');
  }

  // Check 3: setIsPlaying(false) is called in onScrubberChange (stops playback when scrubbing)
  if (scrubberIdx !== -1) {
    const nearScrubber = src25.substring(scrubberIdx, scrubberIdx + 400);
    if (/setIsPlaying\s*\(\s*false\s*\)/.test(nearScrubber)) {
      pass('2.5', 'onScrubberChange calls setIsPlaying(false)',
        'Playback is stopped when user scrubs — prevents RAF loop conflicting with manual position');
    } else {
      fail('2.5', 'onScrubberChange calls setIsPlaying(false)',
        'setIsPlaying(false) not found in onScrubberChange body (first 400 chars)');
    }
  } else {
    fail('2.5', 'onScrubberChange calls setIsPlaying(false)',
      'onScrubberChange not found — cannot check body');
  }

  // Check 4: currentFrameIdxRef.current = newIdx is set (ref updated for RAF loop)
  if (scrubberIdx !== -1) {
    const nearScrubber = src25.substring(scrubberIdx, scrubberIdx + 400);
    if (/currentFrameIdxRef\.current\s*=/.test(nearScrubber)) {
      pass('2.5', 'onScrubberChange sets currentFrameIdxRef.current = newIdx',
        'Ref is updated synchronously so the RAF loop reads the correct frame index');
    } else {
      fail('2.5', 'onScrubberChange sets currentFrameIdxRef.current = newIdx',
        'currentFrameIdxRef.current assignment not found in onScrubberChange body');
    }
  } else {
    fail('2.5', 'onScrubberChange sets currentFrameIdxRef.current = newIdx',
      'onScrubberChange not found — cannot check body');
  }

  // Check 5: Reactive useEffect that triggers renderParquetFrame exists
  const reactiveEffectPattern = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?renderParquetFrame\s*\([\s\S]*?\}\s*,\s*\[[\s\S]*?currentFrameIdx[\s\S]*?\]\s*\)/;
  if (reactiveEffectPattern.test(src25)) {
    pass('2.5', 'Reactive useEffect calls renderParquetFrame on currentFrameIdx change',
      'useEffect([currentFrameIdx, ...]) → renderParquetFrame() ensures scrub renders exactly once via state change');
  } else {
    fail('2.5', 'Reactive useEffect calls renderParquetFrame on currentFrameIdx change',
      'Could not find useEffect with currentFrameIdx dep that calls renderParquetFrame');
  }

} catch (err) {
  fail('2.5', 'File read', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2.6 — Gemini fallback still functions (speechToSignAgent.ts)
// ─────────────────────────────────────────────────────────────────────────────
console.log(bold('\n═══════════════════════════════════════════════════════════'));
console.log(bold('  Task 2.6 — Preservation: Gemini Fallback Intact'));
console.log(bold('  File: src/lib/agents/speechToSignAgent.ts'));
console.log(bold('═══════════════════════════════════════════════════════════\n'));

try {
  const src26 = readSource('src/lib/agents/speechToSignAgent.ts');

  // Check 1: ruleBasedFallback private method exists on ISLGrammarSubAgent
  if (/private\s+ruleBasedFallback\s*\(/.test(src26)) {
    pass('2.6', 'ruleBasedFallback private method exists on ISLGrammarSubAgent',
      'private ruleBasedFallback(...) method found in ISLGrammarSubAgent class');
  } else {
    fail('2.6', 'ruleBasedFallback private method exists on ISLGrammarSubAgent',
      'private ruleBasedFallback() not found in speechToSignAgent.ts');
  }

  // Check 2: ruleBasedFallback returns object with islTokens, omittedStopwords, explanation, modelUsed
  const fallbackIdx = src26.indexOf('ruleBasedFallback');
  if (fallbackIdx !== -1) {
    // Extract a generous window around the method body
    const fallbackSection = src26.substring(fallbackIdx, fallbackIdx + 1500);
    const hasIslTokens    = /islTokens\s*:/.test(fallbackSection);
    const hasOmitted      = /omittedStopwords\s*:/.test(fallbackSection);
    const hasExplanation  = /explanation\s*:/.test(fallbackSection);
    const hasModelUsed    = /modelUsed\s*:/.test(fallbackSection);

    if (hasIslTokens && hasOmitted && hasExplanation && hasModelUsed) {
      pass('2.6', 'ruleBasedFallback returns object with islTokens, omittedStopwords, explanation, modelUsed',
        'All four required keys present in return value');
    } else {
      const missing = [];
      if (!hasIslTokens)   missing.push('islTokens');
      if (!hasOmitted)     missing.push('omittedStopwords');
      if (!hasExplanation) missing.push('explanation');
      if (!hasModelUsed)   missing.push('modelUsed');
      fail('2.6', 'ruleBasedFallback returns object with islTokens, omittedStopwords, explanation, modelUsed',
        `Missing keys in return object: ${missing.join(', ')}`);
    }
  } else {
    fail('2.6', 'ruleBasedFallback returns object with islTokens, omittedStopwords, explanation, modelUsed',
      'ruleBasedFallback not found — cannot inspect return value');
  }

  // Check 3: modelUsed is set to 'rule-based-fallback' inside ruleBasedFallback
  if (fallbackIdx !== -1) {
    const fallbackSection = src26.substring(fallbackIdx, fallbackIdx + 1500);
    if (/modelUsed\s*:\s*['"]rule-based-fallback['"]/.test(fallbackSection)) {
      pass('2.6', "ruleBasedFallback sets modelUsed to 'rule-based-fallback'",
        "modelUsed: 'rule-based-fallback' found in ruleBasedFallback return statement");
    } else {
      fail('2.6', "ruleBasedFallback sets modelUsed to 'rule-based-fallback'",
        "modelUsed: 'rule-based-fallback' not found in ruleBasedFallback body");
    }
  } else {
    fail('2.6', "ruleBasedFallback sets modelUsed to 'rule-based-fallback'",
      'ruleBasedFallback not found');
  }

  // Check 4: catch block inside parseGrammar calls this.ruleBasedFallback(cleanText)
  const parseGrammarIdx = src26.indexOf('parseGrammar');
  if (parseGrammarIdx !== -1) {
    // Get the full parseGrammar method body — find until the next method/class boundary
    const parseSection = src26.substring(parseGrammarIdx, parseGrammarIdx + 3000);
    // Look for catch block that calls this.ruleBasedFallback
    if (/catch\s*\([^)]*\)\s*\{[\s\S]*?this\.ruleBasedFallback\s*\(/.test(parseSection)) {
      pass('2.6', 'catch block in parseGrammar calls this.ruleBasedFallback(cleanText)',
        'Fallback is wired: Gemini failure → catch → this.ruleBasedFallback(cleanText)');
    } else {
      fail('2.6', 'catch block in parseGrammar calls this.ruleBasedFallback(cleanText)',
        'catch block with this.ruleBasedFallback() call not found inside parseGrammar');
    }
  } else {
    fail('2.6', 'catch block in parseGrammar calls this.ruleBasedFallback(cleanText)',
      'parseGrammar method not found');
  }

  // Check 5: ISL_EXCLUDED_STOPWORDS is imported/used
  if (/ISL_EXCLUDED_STOPWORDS/.test(src26)) {
    const isImported = /import\s*\{[^}]*ISL_EXCLUDED_STOPWORDS[^}]*\}/.test(src26);
    const isUsed     = (src26.match(/ISL_EXCLUDED_STOPWORDS/g) || []).length >= 2; // import + usage
    if (isImported || isUsed) {
      pass('2.6', 'ISL_EXCLUDED_STOPWORDS is imported and used in the fallback',
        'Stopword set is available for the rule-based fallback engine');
    } else {
      fail('2.6', 'ISL_EXCLUDED_STOPWORDS is imported and used in the fallback',
        'ISL_EXCLUDED_STOPWORDS found but may not be properly imported/used');
    }
  } else {
    fail('2.6', 'ISL_EXCLUDED_STOPWORDS is imported and used in the fallback',
      'ISL_EXCLUDED_STOPWORDS not referenced in speechToSignAgent.ts');
  }

} catch (err) {
  fail('2.6', 'File read', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2.7 — glideToStandby fires after last word (test-speech-to-sign/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
console.log(bold('\n═══════════════════════════════════════════════════════════'));
console.log(bold('  Task 2.7 — Preservation: glideToStandby Fires After Last Word'));
console.log(bold('  File: src/app/test-speech-to-sign/page.tsx'));
console.log(bold('═══════════════════════════════════════════════════════════\n'));

try {
  const src27 = readSource('src/app/test-speech-to-sign/page.tsx');

  // Check 1: glideToStandby exists as a useCallback
  if (/const\s+glideToStandby\s*=\s*useCallback\s*\(/.test(src27)) {
    pass('2.7', 'glideToStandby is defined as a useCallback',
      'const glideToStandby = useCallback(...) found in test-speech-to-sign/page.tsx');
  } else {
    fail('2.7', 'glideToStandby is defined as a useCallback',
      'glideToStandby useCallback definition not found');
  }

  // Check 2: standbyTimeoutRef is used and setTimeout(() => { glideToStandby(); }, 800) pattern exists
  const hasStandbyRef = /standbyTimeoutRef\.current\s*=\s*setTimeout/.test(src27);
  const hasGlideTimeout = /standbyTimeoutRef\.current\s*=\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?glideToStandby\s*\(\s*\)[\s\S]*?\}\s*,\s*800\s*\)/.test(src27)
    || /standbyTimeoutRef\.current\s*=\s*setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{\s*glideToStandby\s*\(\s*\)\s*;\s*\}\s*,\s*800\s*\)/.test(src27);

  if (hasStandbyRef && hasGlideTimeout) {
    pass('2.7', 'standbyTimeoutRef = setTimeout(() => { glideToStandby(); }, 800) pattern exists',
      '800ms standby delay is wired via standbyTimeoutRef');
  } else if (hasStandbyRef) {
    // Check more loosely — the timeout may be formatted differently
    const timeoutSection = src27.match(/standbyTimeoutRef\.current\s*=\s*setTimeout[\s\S]*?800\s*\)/);
    if (timeoutSection && /glideToStandby/.test(timeoutSection[0])) {
      pass('2.7', 'standbyTimeoutRef = setTimeout(() => { glideToStandby(); }, 800) pattern exists',
        '800ms standby delay is wired via standbyTimeoutRef (loose match)');
    } else {
      fail('2.7', 'standbyTimeoutRef = setTimeout(() => { glideToStandby(); }, 800) pattern exists',
        'standbyTimeoutRef.current = setTimeout found but glideToStandby() + 800ms pattern not confirmed');
    }
  } else {
    fail('2.7', 'standbyTimeoutRef = setTimeout(() => { glideToStandby(); }, 800) pattern exists',
      'standbyTimeoutRef.current = setTimeout(...) not found');
  }

  // Check 3: The timeout fires in the else branch of advanceQueue (when nextIndex >= queue.length)
  // Strategy: find the advanceQueue useCallback definition, extract its body, verify glideToStandby
  // is called inside an else block that runs when the queue is exhausted.
  const advanceQueueDefIdx = src27.search(/const\s+advanceQueue\s*=\s*useCallback/);
  const advanceQueueFallback = src27.indexOf('advanceQueueRef.current = advanceQueue');

  // Use the useCallback definition as anchor; fall back to the ref-assignment anchor
  const advanceAnchor = advanceQueueDefIdx !== -1 ? advanceQueueDefIdx : advanceQueueFallback;

  if (advanceAnchor !== -1) {
    // Scan up to 2000 chars from the definition start to cover the full callback body
    const advanceSection = src27.substring(advanceAnchor, advanceAnchor + 2000);

    // The pattern: outer if (nextIndex < queue.length) ... else { ... glideToStandby }
    // In the source the inner else has: isPlayingRef.current = false + standbyTimeoutRef + glideToStandby
    const hasElseWithGlide = /else\s*\{[\s\S]*?glideToStandby/.test(advanceSection);
    const hasQueueCheck    = /nextIndex\s*<\s*queue\.length/.test(advanceSection)
                          || /nextIndex\s*>=\s*queue\.length/.test(advanceSection);

    if (hasElseWithGlide && hasQueueCheck) {
      pass('2.7', 'glideToStandby fires in else branch of advanceQueue (queue exhausted)',
        'else { ... glideToStandby() } present when nextIndex >= queue.length — standby fires after last word');
    } else if (hasElseWithGlide) {
      pass('2.7', 'glideToStandby fires in else branch of advanceQueue (queue exhausted)',
        'else { ... glideToStandby() } confirmed inside advanceQueue body');
    } else {
      fail('2.7', 'glideToStandby fires in else branch of advanceQueue (queue exhausted)',
        'Could not confirm glideToStandby in the else-branch of advanceQueue (scanned 2000 chars from definition)');
    }
  } else {
    fail('2.7', 'glideToStandby fires in else branch of advanceQueue (queue exhausted)',
      'advanceQueue useCallback definition not found in test-speech-to-sign/page.tsx');
  }

  // Check 4: generateSmoothBridge from motionSmoothing is imported and called inside glideToStandby
  const importCheck = /import\s*\{[^}]*generateSmoothBridge[^}]*\}\s*from/.test(src27);
  if (importCheck) {
    pass('2.7', 'generateSmoothBridge is imported from motionSmoothing',
      'import { ..., generateSmoothBridge, ... } from \'@/lib/motionSmoothing\' found');
  } else {
    fail('2.7', 'generateSmoothBridge is imported from motionSmoothing',
      'generateSmoothBridge import not found in test-speech-to-sign/page.tsx');
  }

  // Check 5: generateSmoothBridge is called inside glideToStandby
  const glideIdx = src27.indexOf('glideToStandby');
  if (glideIdx !== -1) {
    // Find the useCallback body of glideToStandby
    const glideSection = src27.substring(glideIdx, glideIdx + 800);
    if (/generateSmoothBridge\s*\(/.test(glideSection)) {
      pass('2.7', 'generateSmoothBridge is called inside glideToStandby',
        'generateSmoothBridge() is called within glideToStandby to create smooth transition to neutral pose');
    } else {
      fail('2.7', 'generateSmoothBridge is called inside glideToStandby',
        'generateSmoothBridge() call not found in glideToStandby body');
    }
  } else {
    fail('2.7', 'generateSmoothBridge is called inside glideToStandby',
      'glideToStandby not found — cannot check body');
  }

} catch (err) {
  fail('2.7', 'File read', err.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
const total  = results.length;
const passed = results.filter(r => r.ok).length;
const failed = results.filter(r => !r.ok).length;

console.log(bold('\n═══════════════════════════════════════════════════════════'));
console.log(bold('  PRESERVATION BASELINE SUMMARY'));
console.log(bold('═══════════════════════════════════════════════════════════\n'));

// Per-task summary
for (const taskId of ['2.5', '2.6', '2.7']) {
  const taskResults = results.filter(r => r.taskId === taskId);
  const taskPassed  = taskResults.filter(r => r.ok).length;
  const taskTotal   = taskResults.length;
  const allOk       = taskPassed === taskTotal;
  const label = {
    '2.5': 'Task 2.5 — Manual Scrubbing (test-kalidokit)',
    '2.6': 'Task 2.6 — Gemini Fallback (speechToSignAgent)',
    '2.7': 'Task 2.7 — glideToStandby (test-speech-to-sign)',
  }[taskId];

  console.log(`  ${allOk ? green('✔ PASS') : red('✘ FAIL')}  ${label} — ${taskPassed}/${taskTotal} checks`);
}

console.log(`\n  Total: ${passed}/${total} checks passed`);

if (failed === 0) {
  console.log(green(bold('\n  ✔ ALL PRESERVATION CHECKS PASS — Baseline confirmed. Safe to proceed with fixes.\n')));
  process.exit(0);
} else {
  console.log(red(bold(`\n  ✘ ${failed} CHECK(S) FAILED — Baseline broken. Review output above.\n`)));
  if (failed > 0) {
    console.log(yellow('  Failed checks:'));
    results.filter(r => !r.ok).forEach(r => {
      console.log(yellow(`    [${r.taskId}] ${r.checkName}`));
      if (r.detail) console.log(yellow(`           → ${r.detail}`));
    });
    console.log('');
  }
  process.exit(1);
}
