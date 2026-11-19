import { NextRequest, NextResponse } from 'next/server';

const SPEAKER_MAP: Record<string, string> = {
  'en-IN': 'dev_en_conversational',
  'kn-IN': 'chaitra_kn_conversation',
  'hi-IN': 'sarika_hi_conversation',
};

export async function POST(req: NextRequest) {
  try {
    const { text, languageCode = 'en-IN' } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required.' },
        { status: 400 }
      );
    }

    if (text.length > 2500) {
      return NextResponse.json(
        { error: 'Text must not exceed 2500 characters.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SARVAM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'SARVAM_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const speaker = SPEAKER_MAP[languageCode];

    if (!speaker) {
      return NextResponse.json(
        { error: 'Unsupported language code.' },
        { status: 400 }
      );
    }

    const response = await fetch(
      'https://api.sarvam.ai/text-to-speech',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': apiKey,
        },
        body: JSON.stringify({
          inputs: [text.trim()],
          target_language_code: languageCode,
          speaker,
          model: 'bulbul:v4-flash',
          output_audio_codec: 'mp3',
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Sarvam TTS] API error:', errorText);

      return NextResponse.json(
        { error: 'Sarvam speech generation failed.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data.audios || !data.audios[0]) {
      return NextResponse.json(
        { error: 'No audio was returned by Sarvam.' },
        { status: 500 }
      );
    }

    const audioBuffer = Buffer.from(data.audios[0], 'base64');

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[Sarvam TTS] Error:', error);

    return NextResponse.json(
      { error: 'Internal error in Sarvam TTS.' },
      { status: 500 }
    );
  }
}
