import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    packageId: v.id("packages"),
    tourId: v.optional(v.id("tours")),
    encryptedData: v.string(),
    iv: v.string(),
    orderNum: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    // Verify package ownership
    const pkg = await ctx.db.get(args.packageId);
    if (!pkg || pkg.userId !== identity.subject) {
      throw new Error("Package not found");
    }

    // Verify tour ownership if specified
    if (args.tourId) {
      const tour = await ctx.db.get(args.tourId);
      if (!tour || tour.userId !== identity.subject) {
        throw new Error("Tour not found");
      }
    }

    const questionId = await ctx.db.insert("questions", {
      userId: identity.subject,
      packageId: args.packageId,
      tourId: args.tourId,
      encryptedData: args.encryptedData,
      iv: args.iv,
      orderNum: args.orderNum,
      createdAt: Date.now(),
    });

    // Update question count
    const questionCount = await ctx.db
      .query("questions")
      .withIndex("by_package", (q) => q.eq("packageId", args.packageId))
      .collect();

    await ctx.db.patch(args.packageId, {
      questionCount: questionCount.length,
      updatedAt: Date.now(),
    });

    return questionId;
  },
});

export const createBulk = mutation({
  args: {
    questions: v.array(
      v.object({
        packageId: v.id("packages"),
        tourId: v.optional(v.id("tours")),
        encryptedData: v.string(),
        iv: v.string(),
        orderNum: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    if (args.questions.length === 0) {
      return [];
    }

    // Verify package ownership (all questions should belong to same package)
    const packageIds = new Set(args.questions.map((q) => q.packageId));
    for (const packageId of packageIds) {
      const pkg = await ctx.db.get(packageId);
      if (!pkg || pkg.userId !== identity.subject) {
        throw new Error("Package not found");
      }
    }

    const questionIds = [];
    for (const q of args.questions) {
      const questionId = await ctx.db.insert("questions", {
        userId: identity.subject,
        packageId: q.packageId,
        tourId: q.tourId,
        encryptedData: q.encryptedData,
        iv: q.iv,
        orderNum: q.orderNum,
        createdAt: Date.now(),
      });
      questionIds.push(questionId);
    }

    // Update question counts for all affected packages
    for (const packageId of packageIds) {
      const questionCount = await ctx.db
        .query("questions")
        .withIndex("by_package", (q) => q.eq("packageId", packageId))
        .collect();

      await ctx.db.patch(packageId, {
        questionCount: questionCount.length,
        updatedAt: Date.now(),
      });
    }

    return questionIds;
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

    return await ctx.db
      .query("questions")
      .withIndex("by_package", (q) => q.eq("packageId", args.packageId))
      .collect();
  },
});

export const listByTour = query({
  args: { tourId: v.id("tours") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    // Verify tour ownership
    const tour = await ctx.db.get(args.tourId);
    if (!tour || tour.userId !== identity.subject) {
      return [];
    }

    return await ctx.db
      .query("questions")
      .withIndex("by_tour", (q) => q.eq("tourId", args.tourId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("questions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const question = await ctx.db.get(args.id);
    if (!question || question.userId !== identity.subject) {
      return null;
    }

    return question;
  },
});

export const update = mutation({
  args: {
    id: v.id("questions"),
    encryptedData: v.string(),
    iv: v.string(),
    tourId: v.optional(v.id("tours")),
    orderNum: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const question = await ctx.db.get(args.id);
    if (!question || question.userId !== identity.subject) {
      throw new Error("Not found");
    }

    const updates: {
      encryptedData: string;
      iv: string;
      tourId?: typeof args.tourId;
      orderNum?: number;
    } = {
      encryptedData: args.encryptedData,
      iv: args.iv,
    };

    if (args.tourId !== undefined) {
      updates.tourId = args.tourId;
    }
    if (args.orderNum !== undefined) {
      updates.orderNum = args.orderNum;
    }

    await ctx.db.patch(args.id, updates);

    // Update package timestamp
    await ctx.db.patch(question.packageId, {
      updatedAt: Date.now(),
    });
  },
});

export const updateOrder = mutation({
  args: {
    id: v.id("questions"),
    orderNum: v.number(),
    tourId: v.optional(v.id("tours")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const question = await ctx.db.get(args.id);
    if (!question || question.userId !== identity.subject) {
      throw new Error("Not found");
    }

    const updates: { orderNum: number; tourId?: typeof args.tourId } = {
      orderNum: args.orderNum,
    };
    if (args.tourId !== undefined) {
      updates.tourId = args.tourId;
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("questions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const question = await ctx.db.get(args.id);
    if (!question || question.userId !== identity.subject) {
      throw new Error("Not found");
    }

    const packageId = question.packageId;

    // Delete all related images
    const images = await ctx.db
      .query("images")
      .withIndex("by_question", (q) => q.eq("questionId", args.id))
      .collect();

    for (const image of images) {
      await ctx.db.delete(image._id);
    }

    await ctx.db.delete(args.id);

    // Update question count
    const questionCount = await ctx.db
      .query("questions")
      .withIndex("by_package", (q) => q.eq("packageId", packageId))
      .collect();

    await ctx.db.patch(packageId, {
      questionCount: questionCount.length,
      updatedAt: Date.now(),
    });
  },
});
