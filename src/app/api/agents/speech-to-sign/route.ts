import { NextRequest, NextResponse } from 'next/server';
import { speechToSignOrchestrator } from '@/lib/agents/speechToSignAgent';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const { text, apiKey, model, context } = body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text prompt or speech transcript is required.' }, { status: 400 });
    }

    const result = await speechToSignOrchestrator.processInput(text, { apiKey, model, context });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[API /api/agents/speech-to-sign] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error in speech-to-sign orchestration agent.' },
      { status: 500 }
    );
  }
}
