/**
 * Sub-Agent: Context Engine & Fingerspell Auto-Completer
 * Implements a 2-Tier Hybrid Architecture:
 * - Tier 1: 0ms Client/Server Prefix Trie with fuzzy matching against Resume & Job Description.
 * - Tier 2: Google GenAI Contextual Ranker using conversational dialogue history.
 */

import { AutocompletePrediction, ContextPredictorRequest, ContextPredictorResponse } from './types';

// Standard Technical & Domain Vocabulary Base
const DEFAULT_TECH_KEYWORDS = [
  'Kubernetes', 'Docker', 'React', 'Next.js', 'TypeScript', 'JavaScript', 'Python',
  'PostgreSQL', 'Redis', 'GraphQL', 'MongoDB', 'Node.js', 'TailwindCSS', 'AWS',
  'Google Cloud', 'Azure', 'Microservices', 'TensorFlow', 'PyTorch', 'Machine Learning',
  'Artificial Intelligence', 'WebRTC', 'WebSockets', 'REST API', 'Prisma', 'Supabase',
  'Firebase', 'Git', 'GitHub', 'CI/CD', 'Linux', 'Apache Kafka', 'RabbitMQ',
  'Elasticsearch', 'C++', 'Java', 'Spring Boot', 'FastAPI', 'Django', 'Flask',
  'Golang', 'Rust', 'Swift', 'Kotlin', 'Solidity', 'Ethereum', 'Three.js',
  'MediaPipe', 'Kalidokit', 'LiveKit', 'WebAudio', 'Computer Vision', 'Deep Learning',
  'Natural Language Processing', 'Data Structures', 'Algorithms', 'System Design'
];

interface TrieNode {
  children: Map<string, TrieNode>;
  words: Set<string>;
}

class PrefixTrie {
  private root: TrieNode = { children: new Map(), words: new Set() };

  insert(word: string) {
    if (!word || word.length < 2) return;
    const cleanWord = word.trim();
    let current = this.root;
    current.words.add(cleanWord);

    const lower = cleanWord.toLowerCase();
    for (const char of lower) {
      if (!current.children.has(char)) {
        current.children.set(char, { children: new Map(), words: new Set() });
      }
      current = current.children.get(char)!;
      current.words.add(cleanWord);
    }
  }

  find(prefix: string): string[] {
    if (!prefix) return [];
    let current = this.root;
    const lower = prefix.toLowerCase();

    for (const char of lower) {
      if (!current.children.has(char)) {
        return [];
      }
      current = current.children.get(char)!;
    }

    return Array.from(current.words);
  }
}

/**
 * Extracts candidate technical keywords from freeform Resume & Job Description text
 */
export function extractKeywords(text: string): string[] {
  if (!text) return [];
  const words = text.split(/[\s,.;:()\[\]{}"'\/\\]+/);
  const found = new Set<string>();

  for (const raw of words) {
    const w = raw.trim();
    if (w.length >= 3 && /^[A-Za-z0-9+#.-]+$/.test(w)) {
      found.add(w);
    }
  }
  return Array.from(found);
}

export class ContextPredictorAgent {
  private trie: PrefixTrie = new PrefixTrie();
  private contextKeywords: Set<string> = new Set();

  constructor() {
    this.seedDefaultKeywords();
  }

  private seedDefaultKeywords() {
    for (const word of DEFAULT_TECH_KEYWORDS) {
      this.trie.insert(word);
      this.contextKeywords.add(word.toLowerCase());
    }
  }

  /**
   * Ingests candidate resume and job description to personalize the prefix trie
   */
  updateContext(resume?: string, jobDescription?: string) {
    if (resume) {
      const resumeWords = extractKeywords(resume);
      resumeWords.forEach(w => {
        this.trie.insert(w);
        this.contextKeywords.add(w.toLowerCase());
      });
    }
    if (jobDescription) {
      const jdWords = extractKeywords(jobDescription);
      jdWords.forEach(w => {
        this.trie.insert(w);
        this.contextKeywords.add(w.toLowerCase());
      });
    }
  }

  /**
   * Fast hybrid auto-complete:
   * 1. Query Trie for 0ms prefix matches
   * 2. Re-rank based on recent dialogue context (e.g. questions asked)
   * 3. Fall back to Gemini API if online for nuanced conversational completion
   */
  async predict(req: ContextPredictorRequest): Promise<ContextPredictorResponse> {
    const startTime = Date.now();
    const cleanPrefix = req.prefix.trim().toLowerCase();

    if (!cleanPrefix || cleanPrefix.length < 1) {
      return { prefix: req.prefix, predictions: [], latencyMs: 0 };
    }

    // Refresh context if supplied in request
    if (req.candidateResume || req.jobDescription) {
      this.updateContext(req.candidateResume, req.jobDescription);
    }

    // Tier 1: Instant Trie Match
    const trieMatches = this.trie.find(cleanPrefix);

    // Build dialogue relevance scoring
    const dialogueContextText = (req.recentDialogue || [])
      .slice(-3)
      .map(d => d.text.toLowerCase())
      .join(' ');

    const ranked: AutocompletePrediction[] = trieMatches.map(word => {
      let score = 0.70;
      const lowerWord = word.toLowerCase();

      // Prioritize exact prefix match length
      if (lowerWord.startsWith(cleanPrefix)) {
        score += 0.15;
      }

      // Bonus if keyword appeared in recent dialogue or resume
      if (dialogueContextText && dialogueContextText.includes(lowerWord)) {
        score += 0.25;
      }

      // Bonus if present in customized resume keywords
      if (this.contextKeywords.has(lowerWord)) {
        score += 0.10;
      }

      // Penalize excessively long non-relevant words
      if (word.length > 20) {
        score -= 0.10;
      }

      return {
        word,
        confidence: Math.min(0.99, Math.max(0.40, score)),
        source: 'trie_instant',
        category: 'Technology / Resume',
      };
    });

    // Sort by confidence
    ranked.sort((a, b) => b.confidence - a.confidence);
    const topPredictions = ranked.slice(0, 4);

    // Tier 2: If Tier 1 produced fewer than 2 matches and Gemini API key is present
    const geminiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (topPredictions.length < 2 && geminiKey && cleanPrefix.length >= 2) {
      try {
        const prompt = `You are a real-time assistive context engine for a deaf candidate fingerspelling during an interview.
Candidate current typed prefix: "${cleanPrefix}".
Recent conversation: "${dialogueContextText}".
Resume / Job context: "${(req.candidateResume || '').slice(0, 300)}".
Predict the single most likely technical term or word the candidate is spelling. Output ONLY a comma-separated list of 1 to 3 words, nothing else.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 30 },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const predictedWords = candidateText
            .split(',')
            .map((w: string) => w.trim())
            .filter((w: string) => w.length > 1);

          for (const pw of predictedWords) {
            if (!topPredictions.some(p => p.word.toLowerCase() === pw.toLowerCase())) {
              topPredictions.push({
                word: pw,
                confidence: 0.92,
                source: 'llm_context',
                category: 'Google GenAI Prediction',
              });
            }
          }
        }
      } catch (err) {
        console.warn('Gemini Tier 2 fallback encountered error, using Tier 1 Trie:', err);
      }
    }

    const latencyMs = Date.now() - startTime;
    return {
      prefix: req.prefix,
      predictions: topPredictions,
      latencyMs,
    };
  }
}

// Global Singleton for the context agent
export const contextPredictorAgent = new ContextPredictorAgent();
