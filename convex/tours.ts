import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const create = mutation({
  args: {
    packageId: v.id("packages"),
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

    const tourId = await ctx.db.insert("tours", {
      userId: identity.subject,
      packageId: args.packageId,
      encryptedData: args.encryptedData,
      iv: args.iv,
      orderNum: args.orderNum,
      createdAt: Date.now(),
    });

    // Update tour count
    const tourCount = await ctx.db
      .query("tours")
      .withIndex("by_package", (q) => q.eq("packageId", args.packageId))
      .collect();

    await ctx.db.patch(args.packageId, {
      tourCount: tourCount.length,
      updatedAt: Date.now(),
    });

    return tourId;
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
      .query("tours")
      .withIndex("by_package", (q) => q.eq("packageId", args.packageId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const tour = await ctx.db.get(args.id);
    if (!tour || tour.userId !== identity.subject) {
      return null;
    }

    return tour;
  },
});

export const update = mutation({
  args: {
    id: v.id("tours"),
    encryptedData: v.string(),
    iv: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const tour = await ctx.db.get(args.id);
    if (!tour || tour.userId !== identity.subject) {
      throw new Error("Not found");
    }

    await ctx.db.patch(args.id, {
      encryptedData: args.encryptedData,
      iv: args.iv,
    });

    // Update package timestamp
    await ctx.db.patch(tour.packageId, {
      updatedAt: Date.now(),
    });
  },
});

export const updateOrder = mutation({
  args: {
    id: v.id("tours"),
    orderNum: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const tour = await ctx.db.get(args.id);
    if (!tour || tour.userId !== identity.subject) {
      throw new Error("Not found");
    }

    await ctx.db.patch(args.id, {
      orderNum: args.orderNum,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("tours") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthorized");
    }

    const tour = await ctx.db.get(args.id);
    if (!tour || tour.userId !== identity.subject) {
      throw new Error("Not found");
    }

    const packageId = tour.packageId;

    // Remove tour reference from questions (set tourId to undefined)
    const questions = await ctx.db
      .query("questions")
      .withIndex("by_tour", (q) => q.eq("tourId", args.id))
      .collect();

    for (const question of questions) {
      await ctx.db.patch(question._id, { tourId: undefined });
    }

    await ctx.db.delete(args.id);

    // Update tour count
    const tourCount = await ctx.db
      .query("tours")
      .withIndex("by_package", (q) => q.eq("packageId", packageId))
      .collect();

    await ctx.db.patch(packageId, {
      tourCount: tourCount.length,
      updatedAt: Date.now(),
    });
  },
});
