import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

interface TelegramMessage {
  message_id: number;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
  text?: string;
  date: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
}

// Префикс и паттерн кода
const CODE_PREFIX = "CHGK-";
const CODE_PATTERN = /\bCHGK-([A-HJ-NP-Z2-9]{6})\b/;

// Webhook с секретным путём: /tg-webhook
// Секрет проверяется в теле запроса или заголовке
http.route({
  path: "/tg-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

    // Проверяем секрет из заголовка X-Telegram-Bot-Api-Secret-Token
    const headerSecret = request.headers.get("X-Telegram-Bot-Api-Secret-Token");

    if (!webhookSecret || headerSecret !== webhookSecret) {
      console.error("Invalid webhook secret");
      return new Response("Forbidden", { status: 403 });
    }

    if (!botToken) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    try {
      const update: TelegramUpdate = await request.json();
      const message = update.channel_post || update.message;

      // Только каналы
      if (!message?.text || message.chat.type !== "channel") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Быстрая фильтрация: нет префикса - игнорируем
      if (!message.text.includes(CODE_PREFIX)) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      const channelId = String(message.chat.id);

      // Канал уже привязан - игнорируем
      const isLinked = await ctx.runQuery(api.telegram.isChannelLinked, {
        channelId,
      });
      if (isLinked) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      // Извлекаем код (без префикса)
      const match = message.text.match(CODE_PATTERN);
      if (!match) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      const code = match[1];

      // Верифицируем код
      const result = await ctx.runMutation(api.telegram.verifyCodeInternal, {
        code,
        channelId,
        channelTitle: message.chat.title,
      });

      if (result.success) {
        // Удаляем сообщение с кодом
        await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: message.chat.id,
            message_id: message.message_id,
          }),
        });

        // Отправляем подтверждение
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: message.chat.id,
            text: "Канал привязан к CHGK Suite!",
          }),
        });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (err) {
      console.error("Webhook error:", err);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  }),
});

export default http;
