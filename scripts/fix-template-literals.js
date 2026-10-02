const fs = require("fs");
const file = "d:/Matri/src/lib/agents/speechToSignAgent.ts";
let src = fs.readFileSync(file, "utf8");

// Fix 1: mangled fetch URL
const badUrl = "            https://generativelanguage.googleapis.com/v1beta/models/:generateContent?key=\\,";
const goodUrl = "            `https://generativelanguage.googleapis.com/v1beta/models/${this.primaryModel}:generateContent?key=${this.apiKey}`,";
src = src.replace(badUrl, goodUrl);

// Fix 2: mangled regex in JSON.parse
const badRegex = "              parsed = JSON.parse(rawResponseText.replace(/\\json|\\/" + "/g, '').trim());";

// Instead search by partial match
const badLine = src.indexOf("parsed = JSON.parse(rawResponseText.replace(/\\");
if (badLine !== -1) {
  const lineEnd = src.indexOf("\n", badLine);
  const badFull = src.slice(badLine, lineEnd);
  console.log("Found bad regex line:", badFull);
  const goodFull = "              parsed = JSON.parse(rawResponseText.replace(/```json|```/g, '').trim());";
  src = src.replace(src.slice(badLine, lineEnd), goodFull.trim());
}

// Fix 3: mangled console.warn
const badWarn = "          console.warn([ISLGrammarSubAgent] Gemini HTTP , using rule-based engine);";
const goodWarn = '          console.warn(`[ISLGrammarSubAgent] Gemini HTTP ${fetchRes!.status}, using rule-based engine`);';
src = src.replace(badWarn, goodWarn);

fs.writeFileSync(file, src, "utf8");
console.log("Done");
