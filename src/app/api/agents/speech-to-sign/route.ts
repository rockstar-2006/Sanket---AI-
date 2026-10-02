import { NextRequest, NextResponse } from 'next/server';
import { speechToSignOrchestrator } from '@/lib/agents/speechToSignAgent';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text prompt or speech transcript is required.' }, { status: 400 });
    }

    const result = await speechToSignOrchestrator.processInput(text);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[API /api/agents/speech-to-sign] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error in speech-to-sign orchestration agent.' },
      { status: 500 }
    );
  }
}
