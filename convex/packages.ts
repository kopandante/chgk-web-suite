import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    encryptedData: v.string(),
    iv: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    return await ctx.db.insert("packages", {
      userId: identity.subject,
      encryptedData: args.encryptedData,
      iv: args.iv,
      questionCount: 0,
      tourCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    return await ctx.db
      .query("packages")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("packages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const pkg = await ctx.db.get(args.id);
    if (!pkg || pkg.userId !== identity.subject) {
      return null;
    }

    return pkg;
  },
});

export const update = mutation({
  args: {
    id: v.id("packages"),
    encryptedData: v.string(),
    iv: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const pkg = await ctx.db.get(args.id);
    if (!pkg || pkg.userId !== identity.subject) {
      throw new Error("Not found");
    }

    await ctx.db.patch(args.id, {
      encryptedData: args.encryptedData,
      iv: args.iv,
      updatedAt: Date.now(),
    });
  },
});

export const updateCounts = mutation({
  args: {
    id: v.id("packages"),
    questionCount: v.optional(v.number()),
    tourCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const pkg = await ctx.db.get(args.id);
    if (!pkg || pkg.userId !== identity.subject) {
      throw new Error("Not found");
    }

    const updates: { questionCount?: number; tourCount?: number; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (args.questionCount !== undefined) {
      updates.questionCount = args.questionCount;
    }
    if (args.tourCount !== undefined) {
      updates.tourCount = args.tourCount;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("packages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const pkg = await ctx.db.get(args.id);
    if (!pkg || pkg.userId !== identity.subject) {
      throw new Error("Not found");
    }

    // Delete all related tours
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_package", (q) => q.eq("packageId", args.id))
      .collect();

    for (const tour of tours) {
      await ctx.db.delete(tour._id);
    }

    // Delete all related questions and their images
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_package", (q) => q.eq("packageId", args.id))
      .collect();

    for (const question of questions) {
      const images = await ctx.db
        .query("images")
        .withIndex("by_question", (q) => q.eq("questionId", question._id))
        .collect();

      for (const image of images) {
        // Delete file from storage
        await ctx.storage.delete(image.storageId);
        await ctx.db.delete(image._id);
      }

      await ctx.db.delete(question._id);
    }

    // Delete the package
    await ctx.db.delete(args.id);
  },
});
