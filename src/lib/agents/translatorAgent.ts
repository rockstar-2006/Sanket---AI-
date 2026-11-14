/**
 * Sub-Agent: Sign-to-Speech & Speech-to-Sign Bidirectional Translator
 * Implements Indian Sign Language (ISL) Natural Grammar + Vector Embedding Semantic Matching:
 * - Omits English grammatical glue words ('is', 'are', 'am', 'was', 'the', 'a', 'an', 'to', 'do', 'does', etc.)
 * - Vector Embedding Semantic Matcher: Maps synonyms & semantic concepts to the 262 ISL gestures (e.g. 'physician' -> 'doctor')
 * - Maps spoken sentences directly into our 262 ISL vocabulary tokens and dataset .parquet animation files
 * - Falls back to the A-Z fingerspelling dataset for unknown proper nouns and rare technical terms
 */

import { SignTranslationRequest, SignTranslationResponse } from './types';
import { vectorEmbeddingEngine, SemanticMatchResult } from '@/lib/vectorEmbeddingEngine';

// English auxiliary words & grammatical fillers omitted in natural ISL grammar
export const ISL_EXCLUDED_STOPWORDS = new Set([
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'at', 'by',
  'for', 'with', 'about', 'as', 'into', 'do', 'does', 'did',
  'so', 'then', 'just', 'very', 'really'
]);

// The verified 262 ISL vocabulary set in D:\Matri\Dataset
export const VOCABULARY_262 = new Set([
  // Greetings & Basics
  'alright', 'goodafternoon', 'goodevening', 'goodmorning', 'goodnight', 'hello', 'howareyou', 'pleased', 'thankyou',
  // Adjectives
  'alive', 'bad', 'beautiful', 'biglarge', 'blind', 'cheap', 'clean', 'cold', 'cool', 'curved', 'dead', 'deaf',
  'deep', 'dirty', 'dry', 'expensive', 'famous', 'fast', 'female', 'flat', 'good', 'happy', 'hard', 'healthy',
  'heavy', 'high', 'hot', 'light', 'long', 'loose', 'loud', 'low', 'male', 'mean', 'narrow', 'new', 'nice',
  'old', 'poor', 'quiet', 'rich', 'sad', 'shallow', 'short', 'sick', 'slow', 'smalllittle', 'soft', 'strong',
  'tall', 'thick', 'thin', 'tight', 'ugly', 'warm', 'weak', 'wet', 'wide', 'young',
  // Animals
  'animal', 'bird', 'cat', 'cow', 'dog', 'fish', 'horse', 'mouse',
  // Clothes
  'clothing', 'dress', 'hat', 'pant', 'pocket', 'shirt', 'shoes', 'skirt', 'suit', 'tshirt',
  // Colours
  'black', 'blue', 'brown', 'colour', 'green', 'grey', 'orange', 'pink', 'red', 'white', 'yellow',
  // Days & Time
  'afternoon', 'evening', 'friday', 'hour', 'minute', 'monday', 'month', 'morning', 'night', 'saturday',
  'second', 'sunday', 'thursday', 'time', 'today', 'tomorrow', 'tuesday', 'wednesday', 'week', 'year', 'yesterday',
  // Electronics
  'camera', 'cellphone', 'clock', 'computer', 'fan', 'lamp', 'laptop', 'radio', 'screen', 'television',
  // Home
  'bag', 'bathroom', 'bed', 'bedroom', 'book', 'box', 'card', 'chair', 'door', 'dream', 'gift', 'key',
  'kitchen', 'letter', 'lock', 'page', 'paint', 'paper', 'pen', 'pencil', 'photograph', 'ring', 'soap',
  'table', 'telephone', 'tool', 'window',
  // Jobs
  'actor', 'artist', 'author', 'doctor', 'job', 'lawyer', 'manager', 'patient', 'police', 'priest',
  'reporter', 'secretary', 'soldier', 'student', 'teacher', 'waiter',
  // Transportation
  'bicycle', 'boat', 'bus', 'car', 'plane', 'train', 'trainticket', 'transportation', 'truck',
  // People
  'adult', 'baby', 'boy', 'brother', 'child', 'crowd', 'daughter', 'family', 'father', 'friend', 'girl',
  'grandfather', 'grandmother', 'husband', 'king', 'man', 'mother', 'neighbour', 'parent', 'player',
  'president', 'queen', 'sister', 'son', 'wife', 'woman',
  // Places
  'bank', 'city', 'court', 'ground', 'hospital', 'house', 'india', 'library', 'location', 'market',
  'office', 'park', 'restaurant', 'school', 'storeorshop', 'streetorroad', 'temple', 'trainstation', 'university',
  // Pronouns
  'he', 'i', 'it', 'she', 'they', 'we', 'you', 'youplural',
  // Seasons
  'exmonsoon', 'fall', 'season', 'spring', 'summer', 'winter',
  // Society
  'attack', 'ball', 'bill', 'death', 'election', 'energy', 'exercise', 'god', 'gun', 'marriage',
  'medicine', 'money', 'newspaper', 'peace', 'price', 'raceethnicity', 'religion', 'science', 'sign',
  'sport', 'team', 'technology', 'war'
]);

// Common compound phrases mapped to single 262 dataset gestures
export const COMPOUND_PHRASE_MAP: Record<string, string> = {
  'good morning': 'goodmorning',
  'good afternoon': 'goodafternoon',
  'good evening': 'goodevening',
  'good night': 'goodnight',
  'how are you': 'howareyou',
  'thank you': 'thankyou',
  'big large': 'biglarge',
  'small little': 'smalllittle',
  'train ticket': 'trainticket',
  'train station': 'trainstation',
  'store shop': 'storeorshop',
  'store or shop': 'storeorshop',
  'street road': 'streetorroad',
  'street or road': 'streetorroad',
  'you all': 'youplural',
  'cell phone': 'cellphone',
  'mobile phone': 'cellphone',
};

// Direct pronoun & communicative lemmatization to 262 ISL dataset gestures
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

export interface SemanticSubstitution {
  original: string;
  matchedVocab: string;
  similarity: number;
  category: string;
}

export interface ISLTranslatedResult extends SignTranslationResponse {
  islGloss: string[]; // Pure conceptual ISL tokens (e.g. ['WHAT', 'YOUR', 'NAME'])
  parquetWordsToPlay: string[]; // Words with verified .parquet takes in D:\Matri\Dataset
  omittedStopwords: string[]; // Words dropped according to ISL grammar rules (e.g. ['is', 'are'])
  semanticSubstitutions: SemanticSubstitution[]; // Vector embedding synonym matches
}

export class TranslatorAgent {
  /**
   * Translates spoken English into Natural ISL Grammar + Vector Semantic Matching
   */
  translateSpeechToSigns(text: string): ISLTranslatedResult {
    let normalized = text.toLowerCase().trim();

    // 1. Normalize multi-word compounds (e.g. "good morning" -> "goodmorning")
    for (const [phrase, token] of Object.entries(COMPOUND_PHRASE_MAP)) {
      normalized = normalized.replace(new RegExp(`\\b${phrase}\\b`, 'gi'), token);
    }

    // Clean punctuation
    const cleanWords = normalized
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

    const islGloss: string[] = [];
    const omittedStopwords: string[] = [];
    const matchedVocabTokens: string[] = [];
    const parquetWordsToPlay: string[] = [];
    const fingerspellLetters: string[] = [];
    const semanticSubstitutions: SemanticSubstitution[] = [];
    const timeline: Array<{ type: 'word' | 'letter'; token: string; durationMs: number }> = [];

    for (const word of cleanWords) {
      // 2. ISL Grammar Rule: Drop English glue words ("is", "are", "the", "a", etc.)
      if (ISL_EXCLUDED_STOPWORDS.has(word)) {
        omittedStopwords.push(word);
        continue;
      }

      // 3. Exact Match against our 262 Indian Sign Language Dataset
      if (VOCABULARY_262.has(word)) {
        islGloss.push(word.toUpperCase());
        matchedVocabTokens.push(word);
        parquetWordsToPlay.push(word);
        timeline.push({ type: 'word', token: word, durationMs: 1500 });
        continue;
      }

      // 4. Vector Embedding Semantic Matching for Synonyms & Related Concepts (strict 0.85 threshold)
      const semanticMatches = vectorEmbeddingEngine.findSemanticMatches(word, 1, 0.85);
      if (semanticMatches.length > 0 && VOCABULARY_262.has(semanticMatches[0].matchedVocab)) {
        const best = semanticMatches[0];
        semanticSubstitutions.push({
          original: word,
          matchedVocab: best.matchedVocab,
          similarity: best.similarity,
          category: best.category,
        });

        islGloss.push(`${best.matchedVocab.toUpperCase()} (${word})`);
        matchedVocabTokens.push(best.matchedVocab);
        parquetWordsToPlay.push(best.matchedVocab);
        timeline.push({ type: 'word', token: best.matchedVocab, durationMs: 1500 });
        continue;
      }

      // 5. If not matched, add original to gloss and fall back to fingerspelling
      islGloss.push(word.toUpperCase());
      const letters = word.split('');
      for (const l of letters) {
        fingerspellLetters.push(l.toUpperCase());
        timeline.push({ type: 'letter', token: l.toUpperCase(), durationMs: 400 });
      }
    }

    return {
      originalText: text,
      islGloss,
      omittedStopwords,
      semanticSubstitutions,
      matchedVocabTokens,
      parquetWordsToPlay,
      fingerspellLetters,
      formattedSpeech: text,
      avatarKeyframeTimeline: timeline,
    };
  }

  /**
   * Translate signed tokens and fingerspelled completions into natural English speech
   */
  translateSignsToSpeech(tokens: string[]): SignTranslationResponse {
    if (!tokens || tokens.length === 0) {
      return {
        originalText: '',
        matchedVocabTokens: [],
        fingerspellLetters: [],
        formattedSpeech: '',
      };
    }

    const joined = tokens.join(' ');
    const formatted = joined.charAt(0).toUpperCase() + joined.slice(1) + '.';

    return {
      originalText: joined,
      matchedVocabTokens: tokens.filter(t => VOCABULARY_262.has(t.toLowerCase())),
      fingerspellLetters: [],
      formattedSpeech: formatted,
    };
  }
}

export const translatorAgent = new TranslatorAgent();
