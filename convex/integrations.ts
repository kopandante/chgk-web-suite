import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Получить интеграцию по типу
export const getIntegration = query({
  args: {
    userId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrations")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();
  },
});

// Сохранить интеграцию (зашифрованный токен)
export const saveIntegration = mutation({
  args: {
    userId: v.string(),
    type: v.string(),
    encryptedToken: v.string(),
    iv: v.string(),
  },
  handler: async (ctx, args) => {
    // Удалить существующую интеграцию
    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    // Создать новую
    await ctx.db.insert("integrations", {
      userId: args.userId,
      type: args.type,
      encryptedToken: args.encryptedToken,
      iv: args.iv,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// Удалить интеграцию
export const deleteIntegration = mutation({
  args: {
    userId: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("integrations")
      .withIndex("by_user_type", (q) => q.eq("userId", args.userId).eq("type", args.type))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});
