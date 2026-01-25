import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Верификационные коды (временные)
  telegramLinkCodes: defineTable({
    code: v.string(), // без префикса, только 6 символов
    clerkUserId: v.string(),
    channelId: v.optional(v.string()),
    channelTitle: v.optional(v.string()),
    expiresAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_user", ["clerkUserId"]),

  // Привязанные каналы пользователей (множественные)
  telegramChannels: defineTable({
    clerkUserId: v.string(),
    channelId: v.string(),
    channelTitle: v.optional(v.string()),
    linkedAt: v.number(),
  })
    .index("by_user", ["clerkUserId"])
    .index("by_channel", ["channelId"])
    .index("by_user_channel", ["clerkUserId", "channelId"]),
});
