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

  // Пакеты вопросов (зашифрованные)
  packages: defineTable({
    userId: v.string(),
    encryptedData: v.string(), // base64 encrypted JSON {title, editor, date}
    iv: v.string(), // base64 IV for AES-GCM
    questionCount: v.number(),
    tourCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Туры (зашифрованные)
  tours: defineTable({
    userId: v.string(),
    packageId: v.id("packages"),
    encryptedData: v.string(), // base64 encrypted JSON {title}
    iv: v.string(),
    orderNum: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_package", ["packageId"]),

  // Вопросы (зашифрованные)
  questions: defineTable({
    userId: v.string(),
    packageId: v.id("packages"),
    tourId: v.optional(v.id("tours")),
    encryptedData: v.string(), // base64 encrypted JSON {question, answer, zachet, nezachet, comment, source, author, handout, number}
    iv: v.string(),
    orderNum: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_package", ["packageId"])
    .index("by_tour", ["tourId"]),

  // Изображения (зашифрованные, хранятся в Convex File Storage)
  images: defineTable({
    userId: v.string(),
    questionId: v.id("questions"),
    storageId: v.id("_storage"), // ссылка на зашифрованный файл в File Storage
    iv: v.string(), // IV для расшифровки на клиенте
    contentType: v.string(), // MIME type (незашифрован)
    filename: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_question", ["questionId"])
    .index("by_question_filename", ["questionId", "filename"]),

  // Интеграции (зашифрованные токены)
  integrations: defineTable({
    userId: v.string(),
    type: v.string(), // "trello"
    encryptedToken: v.string(), // зашифрованный токен
    iv: v.string(),
    createdAt: v.number(),
  }).index("by_user_type", ["userId", "type"]),
});
