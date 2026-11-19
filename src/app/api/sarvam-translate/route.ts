import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LANGUAGES = ['kn-IN', 'hi-IN'];

export async function POST(req: NextRequest) {
  try {
    const { text, targetLanguageCode } = await req.json();

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required.' },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: 'Text must not exceed 2000 characters.' },
        { status: 400 }
      );
    }

    if (!SUPPORTED_LANGUAGES.includes(targetLanguageCode)) {
      return NextResponse.json(
        { error: 'Unsupported target language.' },
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

    const response = await fetch('https://api.sarvam.ai/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-subscription-key': apiKey,
      },
      body: JSON.stringify({
        input: text.trim(),
        source_language_code: 'en-IN',
        target_language_code: targetLanguageCode,
        model: 'mayura:v1',
        mode: 'modern-colloquial',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Sarvam Translate] API error:', errorText);

      return NextResponse.json(
        { error: 'Translation failed.' },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!data?.translated_text) {
        return NextResponse.json(
            { error: 'Sarvam returned an empty translation.' },
            { status: 502 }
        );
        }

        return NextResponse.json({
        translatedText: data.translated_text,
        });
  } catch (error) {
    console.error('[Sarvam Translate] Error:', error);

    return NextResponse.json(
      { error: 'Internal translation error.' },
      { status: 500 }
    );
  }
}
