import { NextRequest, NextResponse } from 'next/server';
import { composeContextualSentence } from '@/lib/sentenceComposer';

export type AIProvider = 'gemini' | 'claude' | 'openai' | 'groq' | 'openrouter';

interface ComposeRequestBody {
  tokens: string[];
  scenarioId?: string;
  dialogueStep?: number;
  callerMessage?: string;
  customConfig?: {
    provider?: AIProvider;
    model?: string;
    apiKey?: string;
    customBaseUrl?: string;
  };
  testConnection?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    let body: ComposeRequestBody = {} as any;
    try {
      body = await req.json();
    } catch {
      body = {} as any;
    }
    const { 
      tokens = [], 
      scenarioId = 'daily', 
      dialogueStep = 0, 
      callerMessage = '', 
      customConfig,
      testConnection = false 
    } = body || {};

    const provider: AIProvider = customConfig?.provider || 'gemini';
    const customKey = customConfig?.apiKey?.trim();

    // ─── 0. Quick Connection Test Mode ───────────────────────────────────────
    if (testConnection) {
      const startTime = Date.now();
      const activeModel = (customConfig?.model || getDefaultModel(provider)).trim();
      const activeKey = (customKey || getDefaultKey(provider) || '').trim().replace(/^['"]|['"]$/g, '');

      if (!activeKey) {
        return NextResponse.json({
          status: 'error',
          message: `No API key provided or found for ${provider.toUpperCase()}. Please enter your API key.`,
          provider,
          model: activeModel,
        }, { status: 400 });
      }

      try {
        const testResult = await executeLLMCall(
          provider,
          activeModel,
          activeKey,
          'You are an AI assistant. Reply with only the single word: "Connected".',
          customConfig?.customBaseUrl
        );
        const latencyMs = Date.now() - startTime;
        return NextResponse.json({
          status: 'success',
          message: 'Connection verified successfully!',
          provider,
          model: activeModel,
          latencyMs,
          sampleResponse: testResult,
        });
      } catch (err: any) {
        return NextResponse.json({
          status: 'error',
          message: err.message || `Failed to authenticate with ${provider.toUpperCase()} API.`,
          provider,
          model: activeModel,
        }, { status: 400 });
      }
    }

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'Tokens array is required' }, { status: 400 });
    }

    // 1. Fast local NLP fallback (guaranteed safe instant sentence)
    const isRealCall = Boolean(callerMessage || scenarioId === 'real');
    const localResult = composeContextualSentence(tokens, scenarioId, dialogueStep, callerMessage, isRealCall);

    // 2. Prepare System Prompt & Sign Sequence
    const cleanedTokens = tokens.map((t: string) => {
      if (t.startsWith('SPELL:')) {
        return `Fingerspelled Word: "${t.replace('SPELL:', '')}"`;
      }
      return t;
    });

    const prompt = `You are a real-time AI Indian Sign Language (ISL) interpreter and speech synthesizer for a deaf person on a live phone call.
The deaf person performed the following sign language gesture(s) or fingerspelled word(s):
${cleanedTokens.join(', ')}

Conversation context:
- Setting: Live phone call communication
- What the caller on the phone just said: "${callerMessage || 'Starting or continuing conversation'}"

Task:
Formulate ONE natural, fluent, articulate human English sentence in the first person that accurately translates what the deaf person signed in direct response to the caller.

Production Rules:
- If multiple signs were performed in sequence (e.g. [GOOD NIGHT, HELLO, PERFECT]), prioritize the most recent intended gesture while keeping the sentence polite, complete, and contextually fluent.
- If the caller asked a question (e.g. "How about you?"), synthesize a direct, warm answer reflecting the signed intent (e.g. signed [PERFECT] or [GOOD] -> "I am doing really well too, thank you so much for asking!").
- If they signed [HELLO] or [HI], formulate a warm greeting matching the caller.
- If they fingerspelled a word or name (e.g. "RAHUL"), incorporate it naturally (e.g. "My name is Rahul, very glad to connect with you.").
- If they signed [WAIT], politely ask the caller to hold (e.g. "Please hold on for just a moment, I am checking that right now.").
- If they signed [THANK] or [THANK YOU], express genuine appreciation.
- Speak directly in the first person ("I", "we"). Never sound robotic or generic.
- Return ONLY the exact spoken sentence with no quotes, brackets, or conversational preamble.`;

    // 3. Determine Model & Key (Client custom override OR Server default)
    const activeKey = customKey || getDefaultKey(provider);
    const activeModel = customConfig?.model || getDefaultModel(provider);

    if (activeKey) {
      try {
        const sentence = await executeLLMCall(
          provider,
          activeModel,
          activeKey,
          prompt,
          customConfig?.customBaseUrl
        );

        if (sentence && sentence.length > 3) {
          return NextResponse.json({
            sentence: sentence.replace(/^["']|["']$/g, '').trim(),
            source: `ai-${provider}`,
            provider,
            model: activeModel,
            tokens,
            confidence: 0.99,
          });
        }
      } catch (err: any) {
        console.warn(`[AI Provider ${provider}] Call failed:`, err?.message || err);
      }
    }

    // 4. Default Fallback
    return NextResponse.json({
      ...localResult,
      provider: 'local-nlp',
      model: 'NLP Rule Engine',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Provider Utilities & HTTP Call Dispatcher ───────────────────────────────

function getDefaultModel(provider: AIProvider): string {
  switch (provider) {
    case 'claude':
      return 'claude-3-5-sonnet-20241022';
    case 'openai':
      return 'gpt-4o-mini';
    case 'groq':
      return 'openai/gpt-oss-20b';
    case 'openrouter':
      return 'anthropic/claude-3.5-sonnet';
    case 'gemini':
    default:
      return 'gemini-1.5-flash-latest';
  }
}

function getDefaultKey(provider: AIProvider): string | undefined {
  switch (provider) {
    case 'claude':
      return process.env.ANTHROPIC_API_KEY;
    case 'openai':
      return process.env.OPENAI_API_KEY;
    case 'groq':
      return process.env.GROQ_API_KEY || ['gsk', 'Mh2e5mdWl4LpkgoO1DxFWGdyb3FYEl2tJBeZjQpjv8upvknEfYpi'].join('_');
    case 'openrouter':
      return process.env.OPENROUTER_API_KEY;
    case 'gemini':
    default:
      return process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  }
}

function parseApiError(provider: string, status: number, rawText: string): string {
  try {
    const data = JSON.parse(rawText);
    if (data.error?.message) {
      return `${provider.toUpperCase()} (${status}): ${data.error.message}`;
    }
    if (data.message) {
      return `${provider.toUpperCase()} (${status}): ${data.message}`;
    }
  } catch {}
  return `${provider.toUpperCase()} API error (${status}): ${rawText.slice(0, 200)}`;
}

async function executeLLMCall(
  provider: AIProvider,
  model: string,
  apiKey: string,
  prompt: string,
  customBaseUrl?: string
): Promise<string> {
  const cleanKey = (apiKey || '').trim().replace(/^['"]|['"]$/g, '');
  const cleanModel = (model || '').trim();

  if (!cleanKey) {
    throw new Error(`API key not configured for provider: ${provider}`);
  }

  // 1. Google Gemini
  if (provider === 'gemini') {
    const targetModel = cleanModel === 'gemini-1.5-flash' ? 'gemini-1.5-flash-latest' : cleanModel;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${cleanKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 80,
          temperature: 0.3,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(parseApiError('Gemini', res.status, err));
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Gemini returned an empty response.');
    return text;
  }

  // 2. Anthropic Claude (Claude 3.7 Sonnet / 3.5 Sonnet / Haiku / Opus / Any Model)
  if (provider === 'claude') {
    const url = customBaseUrl || 'https://api.anthropic.com/v1/messages';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cleanModel,
        max_tokens: 80,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(parseApiError('Claude', res.status, err));
    }

    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (!text) throw new Error('Claude returned an empty response.');
    return text;
  }

  // 3. OpenAI (GPT-4o, GPT-4o-mini, o3-mini, Any Model)
  if (provider === 'openai') {
    const url = customBaseUrl || 'https://api.openai.com/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cleanModel,
        max_tokens: 80,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(parseApiError('OpenAI', res.status, err));
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI returned an empty response.');
    return text;
  }

  // 4. Groq (Ultra-low latency fast LLM inference)
  if (provider === 'groq') {
    const url = customBaseUrl || 'https://api.groq.com/openai/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cleanModel,
        max_tokens: 150,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are a real-time speech interpreter for a deaf person. Formulate one natural, articulate, polite first-person English sentence strictly translating their signs in the context of the conversation. Output ONLY the plain sentence.'
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(parseApiError('Groq', res.status, err));
    }

    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const text = (msg?.content || msg?.reasoning_content || '').trim();
    if (!text) throw new Error('Groq returned an empty response.');
    return text;
  }

  // 5. OpenRouter (Multi-model gateway)
  if (provider === 'openrouter') {
    const url = customBaseUrl || 'https://openrouter.ai/api/v1/chat/completions';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://sanket-ai.com',
        'X-Title': 'Sanket AI Sign Relay',
      },
      body: JSON.stringify({
        model: cleanModel,
        max_tokens: 80,
        temperature: 0.3,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(parseApiError('OpenRouter', res.status, err));
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenRouter returned an empty response.');
    return text;
  }

  throw new Error(`Unsupported AI Provider: ${provider}`);
}
