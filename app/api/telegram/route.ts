import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "Bot token not configured" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { channelId, text } = body;

    if (!channelId || !text) {
      return NextResponse.json({ ok: false, error: "Missing channelId or text" }, { status: 400 });
    }

    // Проверить, что канал принадлежит пользователю
    const channels = await convex.query(api.telegram.getUserChannels, { clerkUserId: userId });
    const isOwner = channels.some((c) => c.channelId === channelId);
    if (!isOwner) {
      return NextResponse.json({ ok: false, error: "Channel not linked" }, { status: 403 });
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
