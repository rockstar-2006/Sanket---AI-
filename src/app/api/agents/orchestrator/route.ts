import { NextRequest, NextResponse } from 'next/server';
import { meetingOrchestrator } from '@/lib/agents/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, roomId = 'default-room' } = body;

    if (!action) {
      return NextResponse.json({ error: 'Missing action in request body' }, { status: 400 });
    }

    switch (action) {
      case 'predict': {
        const { prefix } = body;
        const predictions = await meetingOrchestrator.handleFingerspellPrefix(roomId, prefix || '');
        return NextResponse.json({ success: true, prefix, predictions });
      }

      case 'interviewer_speech': {
        const { text, senderName } = body;
        const result = meetingOrchestrator.handleInterviewerSpeech(roomId, text || '', senderName);
        return NextResponse.json({ success: true, ...result });
      }

      case 'candidate_signed': {
        const { text, senderName, isAutoCompleted } = body;
        const result = meetingOrchestrator.handleCandidateSigned(roomId, text || '', senderName, !!isAutoCompleted);
        return NextResponse.json({ success: true, ...result });
      }

      case 'set_context': {
        const { resume, jobDescription } = body;
        meetingOrchestrator.setContextDocuments(roomId, resume, jobDescription);
        return NextResponse.json({ success: true, message: 'Context updated successfully' });
      }

      case 'get_summary': {
        const summary = meetingOrchestrator.getMeetingSummary(roomId);
        return NextResponse.json({ success: true, summary });
      }

      default:
        return NextResponse.json({ error: `Unknown agent action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Agents Orchestrator API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal agent error' }, { status: 500 });
  }
}
