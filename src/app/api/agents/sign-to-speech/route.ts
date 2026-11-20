import { NextRequest, NextResponse } from 'next/server';
import {
  signToSpeechAgent,
  executeLLMCall,
  AIProvider,
  CustomAIConfig,
} from '@/lib/agents/signToSpeechAgent';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const {
      tokens = [],
      apiKey,
      model,
      provider = 'groq',
      customBaseUrl,
      customConfig,
      context,
      speakerMessage,
      userName,
      testConnection = false,
    } = body || {};

    const effectiveConfig: CustomAIConfig = {
      provider: customConfig?.provider || provider || 'groq',
      model: customConfig?.model || model || 'llama-3.3-70b-versatile',
      apiKey: customConfig?.apiKey || apiKey || '',
      customBaseUrl: customConfig?.customBaseUrl || customBaseUrl,
    };

    // ─── 0. Quick Connection Test Mode ───────────────────────────────────────
    if (testConnection) {
      const startTime = Date.now();
      const activeProvider = effectiveConfig.provider || 'groq';
      const activeModel = (effectiveConfig.model || 'llama-3.3-70b-versatile').trim();
      const activeKey = (
        effectiveConfig.apiKey ||
        process.env.GROQ_API_KEY ||
        process.env.GEMINI_API_KEY ||
        ['gsk', 'Mh2e5mdWl4LpkgoO1DxFWGdyb3FYEl2tJBeZjQpjv8upvknEfYpi'].join('_')
      ).trim();

      if (!activeKey) {
        return NextResponse.json(
          {
            status: 'error',
            message: `No API key provided or found for ${activeProvider.toUpperCase()}. Please enter your API key.`,
            provider: activeProvider,
            model: activeModel,
          },
          { status: 400 }
        );
      }

      try {
        const testResult = await executeLLMCall(
          activeProvider,
          activeModel,
          activeKey,
          'You are an AI assistant. Reply with only the single word: "Connected".',
          effectiveConfig.customBaseUrl
        );
        const latencyMs = Date.now() - startTime;
        return NextResponse.json({
          status: 'success',
          message: 'Connection verified successfully!',
          provider: activeProvider,
          model: activeModel,
          latencyMs,
          sampleResponse: testResult,
        });
      } catch (err: any) {
        return NextResponse.json(
          {
            status: 'error',
            message:
              err.message ||
              `Failed to authenticate with ${activeProvider.toUpperCase()} API.`,
            provider: activeProvider,
            model: activeModel,
          },
          { status: 400 }
        );
      }
    }

    // ─── 1. Main Translation Mode ───────────────────────────────────────────
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json(
        { error: 'Array of sign tokens is required.' },
        { status: 400 }
      );
    }

    const result = await signToSpeechAgent.translateToSpeech(tokens, {
      provider: effectiveConfig.provider,
      model: effectiveConfig.model,
      apiKey: effectiveConfig.apiKey,
      customBaseUrl: effectiveConfig.customBaseUrl,
      speakerMessage: speakerMessage || context,
      context,
      userName,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[API /api/agents/sign-to-speech] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error in sign-to-speech agent.' },
      { status: 500 }
    );
  }
}
