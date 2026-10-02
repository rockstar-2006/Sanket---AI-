/**
 * Google ADK Multi-Agent Architecture: Speech & Text to ISL Hologram Converter
 * Coordinates specialized sub-agents to translate natural spoken/typed English into
 * Indian Sign Language (ISL) grammar and choreographs smooth 3D Hologram playback.
 */

import 'server-only';
import { VOCABULARY_262, ISL_EXCLUDED_STOPWORDS, COMPOUND_PHRASE_MAP } from './translatorAgent';
import { vectorEmbeddingEngine, SemanticMatchResult } from '@/lib/vectorEmbeddingEngine';

// Direct pronoun & interrogative lemmatization to 262 ISL dataset gestures
export const CONCEPTUAL_LEMMATIZATION_MAP: Record<string, string> = {
  // Pronouns
  your: 'you',
  yours: 'you',
  yourself: 'you',
  my: 'i',
  mine: 'i',
  me: 'i',
  myself: 'i',
  his: 'he',
  him: 'he',
  himself: 'he',
  her: 'she',
  hers: 'she',
  herself: 'she',
  our: 'we',
  ours: 'we',
  us: 'we',
  ourselves: 'we',
  their: 'they',
  theirs: 'they',
  them: 'they',
  themselves: 'they',

  // Common Communicative Concepts
  name: 'sign', // In ISL, personal name is asked via 'sign' (sign-name)
  identity: 'sign',
  who: 'people',
  person: 'people',
  where: 'location',
  when: 'time',
  why: 'reason',
  fast: 'fast',
  automobile: 'car',
  physician: 'doctor',
  clinic: 'hospital',
};

export interface ChoreographedSignAction {
  type: 'word' | 'letter';
  token: string;
  displayLabel: string;
  source: 'dataset_parquet' | 'vector_synonym' | 'fingerspell_letter';
  similarity?: number;
  originalWord?: string;
  parquetWord?: string; // Resolved dataset keyword in D:\Matri\Dataset
  durationMs: number;
}

export interface SpeechToSignPipelineResult {
  originalText: string;
  islGrammarTokens: string[];
  omittedStopwords: string[];
  semanticSubstitutions: Array<{ original: string; matched: string; similarity: number; category: string }>;
  animationQueue: ChoreographedSignAction[];
  modelUsed: string;
  executionTimeMs: number;
  linguisticExplanation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-AGENT 1: ISL Linguistic Grammar Agent (Powered by Gemini Flash)
// ─────────────────────────────────────────────────────────────────────────────
export class ISLGrammarSubAgent {
  private apiKey: string;
  private primaryModel: string = 'gemini-2.0-flash';
  private fallbackModel: string = 'gemini-1.5-flash';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  async parseGrammar(text: string): Promise<{
    islTokens: string[];
    omittedStopwords: string[];
    explanation: string;
    modelUsed: string;
  }> {
    const cleanText = text.trim();
    if (!cleanText) {
      return { islTokens: [], omittedStopwords: [], explanation: 'Empty input', modelUsed: 'none' };
    }

    // If Gemini API Key is available, call Gemini Flash with structured prompt
    if (this.apiKey) {
      try {
        const prompt = `You are an expert Indian Sign Language (ISL) linguist and grammatical parser.
Translate the following spoken English sentence into natural Indian Sign Language (ISL) gloss notation.

Linguistic Rules:
1. OMIT English auxiliary verbs and grammatical glue words that do NOT exist in ISL (such as: "is", "am", "are", "was", "were", "the", "a", "an", "to", "in", "at", "by", "for", "do", "does", "did", "and").
2. Reorder into ISL conceptual syntax (e.g. "What is your name?" becomes ["YOUR", "NAME", "WHAT"] or ["YOU", "NAME", "WHAT"]).
3. Output MUST be valid JSON only, with no markdown code fences, in this exact format:
{
  "islTokens": ["YOUR", "NAME", "WHAT"],
  "omittedStopwords": ["is"],
  "explanation": "In ISL, auxiliary verb 'is' is omitted, and question word 'WHAT' placed at end."
}

Sentence to translate: "${cleanText}"`;

        // 3000ms hard timeout — never block the pipeline indefinitely
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        let fetchRes: Response;
        try {
          fetchRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.primaryModel}:generateContent?key=${this.apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  maxOutputTokens: 250,
                  responseMimeType: 'application/json',
                },
              }),
              signal: controller.signal,
            }
          );
        } finally {
          clearTimeout(timeoutId);
        }

        if (fetchRes!.ok) {
          const data = await fetchRes!.json();
          const rawResponseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawResponseText) {
            let parsed;
            try {
              parsed = JSON.parse(rawResponseText.replace(/```json|```/g, '').trim());
            } catch (parseErr) {
              console.warn('[ISLGrammarSubAgent] JSON parse failed, using rule-based engine. Raw:', rawResponseText?.slice(0, 100));
              return this.ruleBasedFallback(cleanText);
            }
            return {
              islTokens: (parsed.islTokens || []).map((t: string) => t.toUpperCase().trim()),
              omittedStopwords: parsed.omittedStopwords || [],
              explanation: parsed.explanation || 'Translated via Google Gemini Flash',
              modelUsed: this.primaryModel,
            };
          }
        } else {
          console.warn(`[ISLGrammarSubAgent] Gemini HTTP ${fetchRes!.status}, using rule-based engine`);
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          console.warn('[ISLGrammarSubAgent] Gemini timed out (3000ms), using rule-based engine');
        } else {
          console.warn('[ISLGrammarSubAgent] Gemini call failed, using rule-based engine:', err);
        }
      }
    }

    // Rule-Based Fallback Engine
    return this.ruleBasedFallback(cleanText);
  }

  private ruleBasedFallback(text: string): {
    islTokens: string[];
    omittedStopwords: string[];
    explanation: string;
    modelUsed: string;
  } {
    const rawTokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const islTokens: string[] = [];
    const omittedStopwords: string[] = [];

    // Check for "what is your name" pattern
    const lower = text.toLowerCase().trim();
    if (lower.includes('what') && lower.includes('name')) {
      omittedStopwords.push('is', 'what');
      return {
        islTokens: ['YOU', 'SIGN'],
        omittedStopwords,
        explanation: "ISL Linguistic Rule: Interrogatives ('what') and auxiliaries ('is') are non-manual facial cues. Conceptually signed as [YOU] [SIGN] (asking for personal sign-name).",
        modelUsed: 'rule-based-fallback',
      };
    }

    if (lower.includes('how') && lower.includes('you')) {
      omittedStopwords.push('are');
      return {
        islTokens: ['HOWAREYOU'],
        omittedStopwords,
        explanation: "ISL Compound Gesture: 'How are you' is signed as a single unified gesture [HOWAREYOU].",
        modelUsed: 'rule-based-fallback',
      };
    }

    for (const w of rawTokens) {
      if (ISL_EXCLUDED_STOPWORDS.has(w)) {
        omittedStopwords.push(w);
      } else {
        islTokens.push(w.toUpperCase());
      }
    }

    return {
      islTokens,
      omittedStopwords,
      explanation: 'Filtered via local ISL stopword engine (omitted non-sign auxiliary words).',
      modelUsed: 'rule-based-fallback',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-AGENT 2: Vector Semantic Vocabulary Matching Agent
// ─────────────────────────────────────────────────────────────────────────────
export class VectorVocabularySubAgent {
  matchToken(token: string): {
    action: ChoreographedSignAction;
    substitution?: { original: string; matched: string; similarity: number; category: string };
  } {
    const clean = token.toLowerCase().trim();

    // 1. Direct 262 ISL Dataset Match
    if (VOCABULARY_262.has(clean)) {
      return {
        action: {
          type: 'word',
          token: clean,
          displayLabel: clean.toUpperCase(),
          source: 'dataset_parquet',
          parquetWord: clean,
          durationMs: 1400,
        },
      };
    }

    // 2. Direct Pronoun & Communicative Lemmatization (e.g. 'your' -> 'you', 'name' -> 'sign')
    if (CONCEPTUAL_LEMMATIZATION_MAP[clean]) {
      const mapped = CONCEPTUAL_LEMMATIZATION_MAP[clean];
      if (VOCABULARY_262.has(mapped)) {
        return {
          action: {
            type: 'word',
            token: mapped,
            displayLabel: `${mapped.toUpperCase()} (${clean})`,
            source: 'vector_synonym',
            similarity: 0.98,
            originalWord: clean,
            parquetWord: mapped,
            durationMs: 1400,
          },
          substitution: {
            original: clean,
            matched: mapped,
            similarity: 0.98,
            category: 'Grammar / Pronouns',
          },
        };
      }
    }

    // 3. Simple Stemming / Plural stripping (e.g. 'doctors' -> 'doctor', 'cars' -> 'car')
    if (clean.endsWith('s') && clean.length > 2) {
      const singular = clean.slice(0, -1);
      if (VOCABULARY_262.has(singular)) {
        return {
          action: {
            type: 'word',
            token: singular,
            displayLabel: `${singular.toUpperCase()} (plural)`,
            source: 'vector_synonym',
            similarity: 0.95,
            originalWord: clean,
            parquetWord: singular,
            durationMs: 1400,
          },
          substitution: {
            original: clean,
            matched: singular,
            similarity: 0.95,
            category: 'Grammar / Plural',
          },
        };
      }
    }

    // 4. Vector Cosine Similarity Synonym Match (strict threshold 0.85 to protect fingerspelled names)
    const matches = vectorEmbeddingEngine.findSemanticMatches(clean, 1, 0.85);
    if (matches.length > 0 && VOCABULARY_262.has(matches[0].matchedVocab)) {
      const best = matches[0];
      return {
        action: {
          type: 'word',
          token: best.matchedVocab,
          displayLabel: `${best.matchedVocab.toUpperCase()} (${clean})`,
          source: 'vector_synonym',
          similarity: best.similarity,
          originalWord: clean,
          parquetWord: best.matchedVocab,
          durationMs: 1400,
        },
        substitution: {
          original: clean,
          matched: best.matchedVocab,
          similarity: best.similarity,
          category: best.category,
        },
      };
    }

    // 5. Fallback: Word not in dataset -> Will be fingerspelled letter-by-letter
    return {
      action: {
        type: 'word',
        token: clean,
        displayLabel: clean.toUpperCase(),
        source: 'fingerspell_letter',
        durationMs: clean.length * 350,
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MASTER ORCHESTRATOR: Speech-to-Sign Pipeline (Google ADK)
// ─────────────────────────────────────────────────────────────────────────────
export class SpeechToSignOrchestrator {
  private grammarAgent: ISLGrammarSubAgent;
  private vocabAgent: VectorVocabularySubAgent;

  constructor() {
    this.grammarAgent = new ISLGrammarSubAgent();
    this.vocabAgent = new VectorVocabularySubAgent();
  }

  async processInput(inputText: string): Promise<SpeechToSignPipelineResult> {
    const startTime = Date.now();

    // 0. Pre-process verified 262 ISL Compound Phrases (e.g. 'good morning' -> 'goodmorning', 'thank you' -> 'thankyou')
    let processedInput = inputText.trim();
    for (const [phrase, target] of Object.entries(COMPOUND_PHRASE_MAP)) {
      const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
      processedInput = processedInput.replace(regex, target);
    }

    // 1. Grammar parsing sub-agent
    const grammarResult = await this.grammarAgent.parseGrammar(processedInput);

    // 2. Vector vocabulary matching sub-agent
    const animationQueue: ChoreographedSignAction[] = [];
    const semanticSubstitutions: Array<{ original: string; matched: string; similarity: number; category: string }> = [];

    for (const token of grammarResult.islTokens) {
      const match = this.vocabAgent.matchToken(token);

      if (match.substitution) {
        semanticSubstitutions.push(match.substitution);
      }

      if (match.action.source === 'dataset_parquet' || match.action.source === 'vector_synonym') {
        animationQueue.push(match.action);
      } else {
        // Break into fingerspelling letters
        const letters = token.split('');
        for (const char of letters) {
          if (/[A-Z0-9]/i.test(char)) {
            animationQueue.push({
              type: 'letter',
              token: char.toUpperCase(),
              displayLabel: char.toUpperCase(),
              source: 'fingerspell_letter',
              durationMs: 380,
            });
          }
        }
      }
    }

    const executionTimeMs = Date.now() - startTime;

    return {
      originalText: inputText,
      islGrammarTokens: grammarResult.islTokens,
      omittedStopwords: grammarResult.omittedStopwords,
      semanticSubstitutions,
      animationQueue,
      modelUsed: grammarResult.modelUsed,
      executionTimeMs,
      linguisticExplanation: grammarResult.explanation,
    };
  }
}

export const speechToSignOrchestrator = new SpeechToSignOrchestrator();
