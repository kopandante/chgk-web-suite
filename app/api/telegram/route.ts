import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.warn("TELEGRAM_BOT_TOKEN is not set");
}

export async function GET() {
  // Test bot connection - getMe
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await response.json();

    if (data.ok) {
      return NextResponse.json({ ok: true, botName: data.result.username });
    }
    return NextResponse.json({ ok: false, error: data.description || "Invalid token" });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    });
  }
}

export async function POST(request: Request) {
  // Send message to channel
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { channelId, text } = body;

    if (!channelId || !text) {
      return NextResponse.json({ ok: false, error: "Missing channelId or text" }, { status: 400 });
    }

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: channelId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (data.ok) {
      return NextResponse.json({ ok: true, messageId: data.result.message_id });
    }
    return NextResponse.json({ ok: false, error: data.description || "Unknown error" });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    });
  }
}
