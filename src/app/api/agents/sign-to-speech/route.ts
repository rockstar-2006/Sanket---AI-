import { NextRequest, NextResponse } from 'next/server';
import { signToSpeechAgent } from '@/lib/agents/signToSpeechAgent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokens, apiKey, model, context, userName } = body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return NextResponse.json({ error: 'Array of sign tokens is required.' }, { status: 400 });
    }

    const result = await signToSpeechAgent.translateToSpeech(tokens, { apiKey, model, context, userName });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[API /api/agents/sign-to-speech] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error in sign-to-speech agent.' },
      { status: 500 }
    );
  }
}
