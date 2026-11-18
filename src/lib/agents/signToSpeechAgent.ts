/**
 * Google ADK Multi-Agent Architecture: Sign-to-Speech Conversational Translator Agent
 * Translates raw ISL gesture tokens and fingerspelled letters into natural, fluent spoken English.
 * 
 * Works for OPEN, NORMAL DAILY CONVERSATIONS (greetings, plans, feelings, small talk, questions).
 * Features:
 * 1. Automatic Fingerspelling Re-assembly (e.g. ['S', 'A', 'N', 'K', 'E', 'T'] -> "Sanket")
 * 2. High-Frequency Daily Conversational Idiom & Pattern Expander
 * 3. Gemini 2.0 Flash / 1.5 Flash structured expansion with local rule fallback
 */
import { VOCABULARY_262 } from './translatorAgent';

export interface SignToSpeechResult {
  spokenText: string;
  reconstructedTokens: string[];
  originalTokens: string[];
  confidence: number;
  modelUsed: string;
  explanation: string;
}

// Common everyday conversational phrases and their natural spoken English expansion
const DAILY_CONVERSATION_MAP: Record<string, string> = {
  // Greetings & Wellbeing
  'hello': 'Hello! Nice to see you.',
  'hi': 'Hi there!',
  'i': 'I am here.',
  'me': 'It is me.',
  'hello i': 'Hello, I am here.',
  'hello me': 'Hello, it is me.',
  'i deaf': 'I am Deaf and communicating using Indian Sign Language.',
  'i happy': 'I am very happy today!',
  'i ready': 'I am ready for our meeting.',
  'howareyou': 'How are you doing today?',
  'how are you': 'How are you doing today?',
  'good morning': 'Good morning! Hope you are having a wonderful day.',
  'goodmorning': 'Good morning! Hope you are having a wonderful day.',
  'good afternoon': 'Good afternoon!',
  'goodafternoon': 'Good afternoon!',
  'good evening': 'Good evening!',
  'goodevening': 'Good evening!',
  'good night': 'Good night! Take care.',
  'goodnight': 'Good night! Take care.',
  'thank you': 'Thank you so much!',
  'thankyou': 'Thank you so much!',
  'thanks': 'Thanks a lot!',
  'thank you doctor': 'Thank you so much, doctor!',
  'thanks doctor': 'Thanks a lot, doctor!',
  'hello doctor': 'Hello, doctor! Nice to see you.',
  'hello how are you': 'Hello! How are you doing today?',
  'hello doctor how are you': 'Hello doctor, how are you doing today?',
  'please help': 'Could you please help me?',
  'help please': 'Could you please help me?',
  'doctor help': 'Doctor, I need some help please.',
  'help doctor': 'Doctor, could you please help me?',
  'please wait': 'Please wait for a moment.',
  'water please': 'Could I please get some water?',
  'food please': 'Could I please get some food?',
  'thank you help': 'Thank you so much for your help!',
  'thank you very much': 'Thank you very much!',
  'yes thank you': 'Yes, thank you very much.',
  'no thank you': 'No, thank you.',
  'doctor medicine please': 'Doctor, please advise on the medicine.',
  'doctor hospital': 'The doctor is at the hospital.',
  'time please': 'Could you please tell me the time?',
  'time': 'What time is it?',
  'meeting': 'We have a meeting scheduled.',
  'meeting now': 'The meeting is starting right now.',
  'meeting ready': 'I am ready for the meeting.',
  'house': 'I am at home.',
  'car': 'The car is ready.',
  'car please': 'Could you please arrange the car?',
  'book': 'Please open the book.',
  'welcome': 'You are most welcome.',
  'pleased': 'Pleased to meet you.',
  'alright': 'Everything is alright.',
  'ok': 'Okay, sounds good.',
  'yes': 'Yes, absolutely.',
  'no': 'No, not right now.',
  'wait': 'Please give me a moment.',
  'help': 'Could you please help me with this?',
  'repeat': 'Could you please repeat that?',
  'agree': 'I completely agree with you.',
  'disagree': 'I see it a bit differently.',

  // Daily Questions & Social Plans
  'you free today': 'Are you free to chat today?',
  'we meet tomorrow': 'Let us meet tomorrow.',
  'what time meet': 'What time should we meet?',
  'yesterday i tired': 'I was really tired yesterday.',
  'food you eat': 'Did you have food yet?',
  'i busy': 'I am currently quite busy.',
  'where house': 'Where is your house located?',
  'where you': 'Where are you right now?',
  'see you soon': 'See you soon! Take care.',
  'call me': 'Please give me a call when you are free.',
  'love it': 'I really love it!',
  'i love you': 'I really love it, thank you!',
  'v': 'Peace to everyone!',
  'peace': 'Peace to everyone!',
  'perfect': 'That sounds perfect.',
};

export class SignToSpeechAgent {
  private apiKey: string;
  private primaryModel: string = 'gemini-2.0-flash';
  private fallbackModel: string = 'gemini-1.5-flash';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
  }

  /**
   * Reconstructs words from consecutive individual fingerspelled letters
   * e.g. ['MY', 'NAME', 'S', 'A', 'N', 'K', 'E', 'T'] -> ['my', 'name', 'sanket']
   */
  reconstructTokens(rawTokens: string[]): string[] {
    const output: string[] = [];
    let letterBuffer: string[] = [];

    const flushBuffer = () => {
      if (letterBuffer.length > 0) {
        const spelled = letterBuffer.join('').toLowerCase();
        // Intelligent Word Prediction & Abbreviation Expansion for Fingerspelling
        const STEM_MAP: Record<string, string> = {
          doc: 'doctor',
          dr: 'doctor',
          hosp: 'hospital',
          med: 'medicine',
          pat: 'patient',
          app: 'appointment',
          thx: 'thanks',
          pls: 'please',
          msg: 'message',
          fam: 'family',
          sch: 'school',
        };
        const resolved = STEM_MAP[spelled] || spelled;
        if (output.length === 0 || output[output.length - 1] !== resolved) {
          output.push(resolved);
        }
        letterBuffer = [];
      }
    };

    for (const raw of rawTokens) {
      const clean = raw.trim().toLowerCase();
      if (!clean) continue;

      // If it's a single character letter (fingerspelling)
      if (clean.length === 1 && /[a-z0-9]/i.test(clean)) {
        letterBuffer.push(clean);
      } else {
        flushBuffer();
        if (output.length === 0 || output[output.length - 1] !== clean) {
          output.push(clean);
        }
      }
    }

    flushBuffer();
    return output;
  }

  /**
   * Translates recognized ISL sign tokens into fluent spoken English
   */
  async translateToSpeech(
    tokens: string[],
    options?: { apiKey?: string; model?: string; context?: string; userName?: string }
  ): Promise<SignToSpeechResult> {
    if (!tokens || tokens.length === 0) {
      return {
        spokenText: '',
        reconstructedTokens: [],
        originalTokens: [],
        confidence: 0,
        modelUsed: 'none',
        explanation: 'No tokens provided.',
      };
    }

    // 0. Remove redundant consecutive duplicates from raw tokens (e.g. ['hello', 'hello'] -> ['hello'])
    const dedupedRaw: string[] = [];
    for (const t of tokens) {
      const clean = t.trim();
      const last = dedupedRaw[dedupedRaw.length - 1];
      if (clean && clean.toUpperCase() !== last?.toUpperCase()) {
        dedupedRaw.push(clean);
      }
    }

    const effectiveApiKey = options?.apiKey || this.apiKey;
    const effectiveModel = options?.model || this.primaryModel;

    // 1. Reconstruct fingerspelled letters into coherent words
    const reconstructed = this.reconstructTokens(dedupedRaw);
    const joinedLower = reconstructed.join(' ').toLowerCase();

    // Dynamic Profile Context: If tokens represent a self-introduction using the signer's profile name
    const cleanUser = options?.userName?.trim();
    if (cleanUser) {
      const firstUser = cleanUser.split(/\s+/)[0]?.toLowerCase();
      const fullUser = cleanUser.toLowerCase();
      const isNameQuery = 
        joinedLower === 'name' || 
        joinedLower === 'my name' || 
        joinedLower === 'i name' || 
        (firstUser && (
          joinedLower === `name ${firstUser}` ||
          joinedLower === `i ${firstUser}` ||
          joinedLower === `my name ${firstUser}` ||
          joinedLower === firstUser ||
          joinedLower === fullUser
        ));

      if (isNameQuery) {
        return {
          spokenText: `My name is ${cleanUser}.`,
          reconstructedTokens: reconstructed,
          originalTokens: tokens,
          confidence: 0.99,
          modelUsed: 'profile-context-rule',
          explanation: 'Inferred full name self-introduction dynamically from user account profile.',
        };
      }
    }

    // 2. Fast Path: Check high-frequency daily conversational idiom map
    if (DAILY_CONVERSATION_MAP[joinedLower]) {
      return {
        spokenText: DAILY_CONVERSATION_MAP[joinedLower],
        reconstructedTokens: reconstructed,
        originalTokens: tokens,
        confidence: 0.98,
        modelUsed: 'daily-conversational-idiom-map',
        explanation: 'Matched verified open conversational daily dialogue pattern.',
      };
    }

    // 3. Check for general "name [name]" or "my name [name]" pattern
    if (reconstructed.length >= 2 && (reconstructed[0] === 'my' || reconstructed[0] === 'i' || reconstructed[0] === 'name')) {
      const namePart = reconstructed.filter(w => w !== 'my' && w !== 'i' && w !== 'name' && w !== 'sign')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const name = namePart || cleanUser || 'Signer';
      return {
        spokenText: `My name is ${name}.`,
        reconstructedTokens: reconstructed,
        originalTokens: tokens,
        confidence: 0.96,
        modelUsed: 'name-introduction-grammar-pattern',
        explanation: 'Reconstructed self-introduction from tokens.',
      };
    }

    // 4. If Gemini API is available, call Gemini Flash for fluent natural conversation expansion
    if (effectiveApiKey) {
      try {
        const contextClause = options?.context ? `\nMeeting Context & Biography: "${options.context}"` : '';
        const userClause = options?.userName ? `\nDeaf Signer's Name: "${options.userName}"` : '';

        const prompt = `You are a conversational translation assistant in an open video call between a Deaf participant signing in Indian Sign Language (ISL) and a hearing participant listening to spoken voice.
Convert the following sequence of signed concepts/tokens into ONE natural, fluent, friendly spoken English sentence as someone would say in this context.
${userClause}${contextClause}

Rules:
1. Preserve the natural casual tone of open daily conversation.
2. Expand telegraphic sign concepts into complete, polite, grammatical English.
3. If the user signs concepts regarding their name or identity, refer to their name (${options?.userName || 'User'}) appropriately.
4. Output MUST be valid JSON only, with no markdown code fences, in this exact format:
{
  "spokenSentence": "Natural English sentence here.",
  "confidence": 0.95
}

Signed tokens: [${reconstructed.map(t => `"${t}"`).join(', ')}]`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);

        const fetchRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${effectiveApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 120,
              },
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeoutId);

        if (fetchRes.ok) {
          const geminiData = await fetchRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          const cleanedJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          let parsed: any = null;
          if (cleanedJson) {
            try {
              parsed = JSON.parse(cleanedJson);
            } catch (jsonErr) {
              console.warn('[SignToSpeechAgent] Failed to parse model JSON:', cleanedJson, jsonErr);
            }
          }
          if (parsed?.spokenSentence) {
            return {
              spokenText: parsed.spokenSentence,
              reconstructedTokens: reconstructed,
              originalTokens: tokens,
              confidence: parsed.confidence || 0.92,
              modelUsed: effectiveModel,
              explanation: 'Fluently expanded via Gemini Flash NLP model with meeting context.',
            };
          }
        }
      } catch (err) {
        console.warn('[SignToSpeechAgent] Gemini API timeout/error, using conversational rule fallback:', err);
      }
    }

    // 5. Rule-Based Grammatical Fallback
    const words = reconstructed.map((w) => {
      // Capitalize proper nouns
      if (w.length > 1 && !VOCABULARY_262.has(w)) {
        return w.charAt(0).toUpperCase() + w.slice(1);
      }
      return w;
    });

    // Determine sentence punctuation (question vs statement)
    const questionWords = new Set(['what', 'where', 'when', 'why', 'who', 'how', 'which']);
    const isQuestion = words.some(w => questionWords.has(w.toLowerCase()));

    const joined = words.join(' ');
    const capitalized = joined.charAt(0).toUpperCase() + joined.slice(1);
    const finalSpoken = capitalized + (isQuestion ? '?' : '.');
    const cleanSpoken = finalSpoken.replace(/\b(\w+)(?:\s+\1\b)+/gi, '$1').trim();

    return {
      spokenText: cleanSpoken,
      reconstructedTokens: reconstructed,
      originalTokens: tokens,
      confidence: 0.88,
      modelUsed: 'rule-based-conversational-engine',
      explanation: 'Constructed via local open conversational grammatical parser.',
    };
  }
}

export const signToSpeechAgent = new SignToSpeechAgent();
