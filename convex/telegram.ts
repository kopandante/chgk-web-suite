import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Символы без похожих (без I, O, 0, 1)
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_PREFIX = "CHGK-";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

// Проверить, привязан ли канал к кому-либо
export const isChannelLinked = query({
  args: { channelId: v.string() },
  handler: async (ctx, args) => {
    const channel = await ctx.db
      .query("telegramChannels")
      .withIndex("by_channel", (q) => q.eq("channelId", args.channelId))
      .first();
    return !!channel;
  },
});

// Создать код для привязки канала
export const createLinkCode = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    // Удалить старые коды этого пользователя
    const existingCodes = await ctx.db
      .query("telegramLinkCodes")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    for (const code of existingCodes) {
      await ctx.db.delete(code._id);
    }

    // Генерируем уникальный код
    let code: string;
    let attempts = 0;
    do {
      code = generateCode();
      const existing = await ctx.db
        .query("telegramLinkCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    // Код действует 10 минут
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await ctx.db.insert("telegramLinkCodes", {
      code,
      clerkUserId: args.clerkUserId,
      expiresAt,
    });

    return {
      code: `${CODE_PREFIX}${code}`, // возвращаем с префиксом для отображения
      expiresAt,
    };
  },
});

// Получить статус привязки (real-time)
export const getLinkStatus = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const linkCode = await ctx.db
      .query("telegramLinkCodes")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!linkCode) {
      return { status: "none" as const };
    }

    if (Date.now() > linkCode.expiresAt) {
      return { status: "expired" as const };
    }

    if (linkCode.channelId) {
      return {
        status: "verified" as const,
        channelId: linkCode.channelId,
        channelTitle: linkCode.channelTitle,
      };
    }

    return {
      status: "pending" as const,
      code: `${CODE_PREFIX}${linkCode.code}`, // с префиксом
      expiresAt: linkCode.expiresAt,
    };
  },
});

// Получить ВСЕ привязанные каналы пользователя
export const getUserChannels = query({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("telegramChannels")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();
  },
});

// Сохранить привязанный канал после верификации (добавить к списку)
export const saveChannel = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    // Найти верифицированный код
    const linkCode = await ctx.db
      .query("telegramLinkCodes")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();

    if (!linkCode || !linkCode.channelId) {
      throw new Error("No verified channel found");
    }

    const { channelId, channelTitle } = linkCode;

    // Проверить, не привязан ли уже этот канал к этому пользователю
    const existingChannel = await ctx.db
      .query("telegramChannels")
      .withIndex("by_user_channel", (q) =>
        q.eq("clerkUserId", args.clerkUserId).eq("channelId", channelId),
      )
      .first();

    if (existingChannel) {
      // Обновить название, если изменилось
      await ctx.db.patch(existingChannel._id, {
        channelTitle,
      });
    } else {
      // Добавить новый канал
      await ctx.db.insert("telegramChannels", {
        clerkUserId: args.clerkUserId,
        channelId,
        channelTitle,
        linkedAt: Date.now(),
      });
    }

    // Удалить код
    await ctx.db.delete(linkCode._id);

    return {
      channelId,
      channelTitle,
    };
  },
});

// Отвязать конкретный канал
export const unlinkChannel = mutation({
  args: {
    clerkUserId: v.string(),
    channelId: v.string(),
  },
  handler: async (ctx, args) => {
    const channel = await ctx.db
      .query("telegramChannels")
      .withIndex("by_user_channel", (q) =>
        q.eq("clerkUserId", args.clerkUserId).eq("channelId", args.channelId),
      )
      .first();

    if (channel) {
      await ctx.db.delete(channel._id);
    }

    return { success: true };
  },
});

// Отменить привязку (удалить pending код)
export const cancelLinking = mutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const codes = await ctx.db
      .query("telegramLinkCodes")
      .withIndex("by_user", (q) => q.eq("clerkUserId", args.clerkUserId))
      .collect();

    for (const code of codes) {
      await ctx.db.delete(code._id);
    }

    return { success: true };
  },
});

// Внутренняя мутация для верификации кода (вызывается из webhook)
export const verifyCodeInternal = mutation({
  args: {
    code: v.string(), // без префикса
    channelId: v.string(),
    channelTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const linkCode = await ctx.db
      .query("telegramLinkCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!linkCode) {
      return { success: false, reason: "code_not_found" };
    }

    if (Date.now() > linkCode.expiresAt) {
      return { success: false, reason: "code_expired" };
    }

    if (linkCode.channelId) {
      return { success: false, reason: "already_verified" };
    }

    // Обновить код с данными канала
    await ctx.db.patch(linkCode._id, {
      channelId: args.channelId,
      channelTitle: args.channelTitle,
    });

    return { success: true, clerkUserId: linkCode.clerkUserId };
  },
});
