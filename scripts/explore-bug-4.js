/**
 * BUG 4 Exploration Script — API Key in Client Bundle
 * =====================================================
 * Phase 1: Exploration (UNFIXED code)
 *
 * Checks bug conditions in src/lib/agents/speechToSignAgent.ts:
 *   C1: NEXT_PUBLIC_GEMINI_API_KEY appears in source (key exposure bug)
 *   C2: `import 'server-only'` does NOT appear (missing server guard)
 *   C3: NEXT_PUBLIC_GEMINI_API_KEY is inside the constructor/apiKey assignment (not a comment)
 *   C4: GEMINI_API_KEY (without NEXT_PUBLIC_) also exists (server-safe key is present)
 *
 * Exit 0 → ALL bug conditions confirmed (bugs exist as expected on unfixed code)
 * Exit 1 → One or more conditions missing (unexpected — code may already be fixed)
 */

const fs = require('fs');
const path = require('path');

const TARGET_FILE = path.resolve(__dirname, '../src/lib/agents/speechToSignAgent.ts');

console.log('='.repeat(70));
console.log('BUG 4 EXPLORATION: API Key in Client Bundle');
console.log('='.repeat(70));
console.log(`Target: ${TARGET_FILE}`);
console.log('');

// Read the source file
let source;
try {
  source = fs.readFileSync(TARGET_FILE, 'utf8');
} catch (err) {
  console.error(`ERROR: Could not read target file: ${err.message}`);
  process.exit(1);
}

const lines = source.split('\n');

// ─── Helper: find all matching line numbers (1-indexed) ───────────────────────
function findLines(pattern) {
  const results = [];
  lines.forEach((line, idx) => {
    if (pattern.test(line)) {
      results.push({ lineNo: idx + 1, text: line.trimEnd() });
    }
  });
  return results;
}

let allBugConditionsFound = true;

// ─── C1: NEXT_PUBLIC_GEMINI_API_KEY appears in source ─────────────────────────
console.log('--- C1: NEXT_PUBLIC_GEMINI_API_KEY appears in source ---');
const c1Matches = findLines(/NEXT_PUBLIC_GEMINI_API_KEY/);
if (c1Matches.length > 0) {
  console.log(`  ✓ FOUND (${c1Matches.length} occurrence(s)):`);
  c1Matches.forEach(({ lineNo, text }) => console.log(`    Line ${lineNo}: ${text}`));
} else {
  console.log('  ✗ NOT FOUND — bug condition C1 missing (unexpected on unfixed code)');
  allBugConditionsFound = false;
}
console.log('');

// ─── C2: `import 'server-only'` does NOT appear (guard is missing) ─────────────
console.log("--- C2: `import 'server-only'` is ABSENT (missing guard) ---");
const c2Matches = findLines(/import\s+['"]server-only['"]/);
if (c2Matches.length === 0) {
  console.log("  ✓ CONFIRMED: `import 'server-only'` not present (guard is missing as expected)");
} else {
  console.log("  ✗ UNEXPECTED: `import 'server-only'` already present:");
  c2Matches.forEach(({ lineNo, text }) => console.log(`    Line ${lineNo}: ${text}`));
  allBugConditionsFound = false;
}
console.log('');

// ─── C3: NEXT_PUBLIC_GEMINI_API_KEY is in constructor/apiKey assignment ─────────
console.log('--- C3: NEXT_PUBLIC_GEMINI_API_KEY is inside constructor apiKey assignment ---');
// Look for the assignment line containing both `apiKey` (or `this.apiKey`) and NEXT_PUBLIC_GEMINI_API_KEY
// and confirm it is NOT a comment-only line
const c3Matches = findLines(/NEXT_PUBLIC_GEMINI_API_KEY/).filter(({ text }) => {
  const trimmed = text.trim();
  // Exclude pure comment lines (start with // or *)
  const isComment = trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
  // Must contain assignment context
  const hasAssignment = /apiKey|process\.env/.test(trimmed);
  return !isComment && hasAssignment;
});
if (c3Matches.length > 0) {
  console.log(`  ✓ FOUND in constructor apiKey assignment (${c3Matches.length} line(s)):`);
  c3Matches.forEach(({ lineNo, text }) => console.log(`    Line ${lineNo}: ${text}`));
} else {
  console.log('  ✗ NOT FOUND in constructor assignment — C3 condition missing');
  allBugConditionsFound = false;
}
console.log('');

// ─── C4: GEMINI_API_KEY (without NEXT_PUBLIC_) also present ──────────────────
console.log('--- C4: GEMINI_API_KEY (server-safe, without NEXT_PUBLIC_) is also present ---');
// Match GEMINI_API_KEY that is NOT preceded by NEXT_PUBLIC_
const c4Matches = findLines(/process\.env\.GEMINI_API_KEY(?!_)/).filter(({ text }) => {
  // Make sure this isn't just on the NEXT_PUBLIC_ line (those also contain GEMINI_API_KEY as a substring)
  // We want occurrences where NEXT_PUBLIC_ does NOT precede GEMINI_API_KEY
  return /process\.env\.GEMINI_API_KEY(?!_)/.test(text.replace(/NEXT_PUBLIC_GEMINI_API_KEY/g, ''));
});
// Simpler re-check: find lines with GEMINI_API_KEY not preceded by NEXT_PUBLIC_
const c4MatchesDirect = [];
lines.forEach((line, idx) => {
  // Remove NEXT_PUBLIC_GEMINI_API_KEY from the line, then check if GEMINI_API_KEY still exists
  const stripped = line.replace(/NEXT_PUBLIC_GEMINI_API_KEY/g, '__REMOVED__');
  if (/GEMINI_API_KEY/.test(stripped)) {
    c4MatchesDirect.push({ lineNo: idx + 1, text: line.trimEnd() });
  }
});
if (c4MatchesDirect.length > 0) {
  console.log(`  ✓ FOUND (${c4MatchesDirect.length} occurrence(s)) — server-safe key IS referenced:`);
  c4MatchesDirect.forEach(({ lineNo, text }) => console.log(`    Line ${lineNo}: ${text}`));
} else {
  console.log('  ✗ NOT FOUND — GEMINI_API_KEY (server-safe) not present');
  allBugConditionsFound = false;
}
console.log('');

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('='.repeat(70));
console.log('COUNTEREXAMPLE DOCUMENTATION:');
console.log('='.repeat(70));

// Find the exact constructor line for the counterexample report
const constructorLine = c3Matches[0] || c1Matches[0];
if (constructorLine) {
  console.log(`  Line ${constructorLine.lineNo} has \`process.env.NEXT_PUBLIC_GEMINI_API_KEY\` in the constructor.`);
}
console.log(`  No 'server-only' import exists.`);
console.log(`  If this file were accidentally imported client-side, Next.js would inline`);
console.log(`  the value of NEXT_PUBLIC_GEMINI_API_KEY into the JS bundle at build time,`);
console.log(`  exposing the API key to any browser that downloads the bundle.`);
console.log('');

if (allBugConditionsFound) {
  console.log('RESULT: ✓ ALL BUG CONDITIONS CONFIRMED');
  console.log('  → Bug 4 exists as expected on unfixed code.');
  console.log('  → Fix needed: remove NEXT_PUBLIC_GEMINI_API_KEY fallback + add server-only guard.');
  process.exit(0);
} else {
  console.log('RESULT: ✗ ONE OR MORE BUG CONDITIONS MISSING');
  console.log('  → Code may already be fixed, or the bug location has changed.');
  process.exit(1);
}
