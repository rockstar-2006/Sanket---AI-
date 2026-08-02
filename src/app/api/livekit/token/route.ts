import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const room = searchParams.get("room");
  const identity = searchParams.get("identity");
  const name = searchParams.get("name") || identity || "Participant";

  if (!room || !identity) {
    return NextResponse.json(
      { error: 'Missing required parameters: "room" and "identity"' },
      { status: 400 }
    );
  }

  // Use environment variables for LiveKit project keys
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    console.error("[LiveKit Token API] Missing LiveKit environment variables configuration.");
    return NextResponse.json(
      { error: "LiveKit server environment credentials are not configured on this host." },
      { status: 500 }
    );
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: identity,
      name: name,
    });

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token, url: livekitUrl });
  } catch (error) {
    console.error("[LiveKit Token API] Token generation error:", error);
    return NextResponse.json(
      { error: "Internal server error generating Access Token." },
      { status: 500 }
    );
  }
}
