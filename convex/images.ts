import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate upload URL for encrypted image
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    return await ctx.storage.generateUploadUrl();
  },
});

// Save image metadata after upload
export const create = mutation({
  args: {
    questionId: v.id("questions"),
    storageId: v.id("_storage"),
    iv: v.string(),
    contentType: v.string(),
    filename: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Verify question ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== identity.subject) {
      throw new Error("Question not found");
    }

    return await ctx.db.insert("images", {
      userId: identity.subject,
      questionId: args.questionId,
      storageId: args.storageId,
      iv: args.iv,
      contentType: args.contentType,
      filename: args.filename,
      createdAt: Date.now(),
    });
  },
});

export const listByQuestion = query({
  args: { questionId: v.id("questions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Verify question ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== identity.subject) {
      return [];
    }

    const images = await ctx.db
      .query("images")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();

    // Add download URLs
    return Promise.all(
      images.map(async (image) => ({
        ...image,
        url: await ctx.storage.getUrl(image.storageId),
      })),
    );
  },
});

export const get = query({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const image = await ctx.db.get(args.id);
    if (!image || image.userId !== identity.subject) {
      return null;
    }

    return {
      ...image,
      url: await ctx.storage.getUrl(image.storageId),
    };
  },
});

export const remove = mutation({
  args: { id: v.id("images") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const image = await ctx.db.get(args.id);
    if (!image || image.userId !== identity.subject) {
      throw new Error("Not found");
    }

    // Delete file from storage
    await ctx.storage.delete(image.storageId);

    // Delete metadata
    await ctx.db.delete(args.id);
  },
});

export const listByPackage = query({
  args: { packageId: v.id("packages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Verify package ownership
    const pkg = await ctx.db.get(args.packageId);
    if (!pkg || pkg.userId !== identity.subject) {
      return [];
    }

    // Get all questions for this package
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_package", (q) => q.eq("packageId", args.packageId))
      .collect();

    // Get all images for these questions
    const allImages = [];
    for (const question of questions) {
      const images = await ctx.db
        .query("images")
        .withIndex("by_question", (q) => q.eq("questionId", question._id))
        .collect();

      for (const image of images) {
        allImages.push({
          ...image,
          url: await ctx.storage.getUrl(image.storageId),
        });
      }
    }

    return allImages;
  },
});

export const removeByQuestion = mutation({
  args: { questionId: v.id("questions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Verify question ownership
    const question = await ctx.db.get(args.questionId);
    if (!question || question.userId !== identity.subject) {
      throw new Error("Question not found");
    }

    const images = await ctx.db
      .query("images")
      .withIndex("by_question", (q) => q.eq("questionId", args.questionId))
      .collect();

    for (const image of images) {
      // Delete file from storage
      await ctx.storage.delete(image.storageId);
      // Delete metadata
      await ctx.db.delete(image._id);
    }
  },
});
