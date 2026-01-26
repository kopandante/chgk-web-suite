import { z } from "zod";

const structuredFieldSchema = z.object({
  header: z.string().optional(),
  items: z.array(z.string()),
});

const questionFieldSchema = z.union([z.string(), structuredFieldSchema]);

export const questionFormSchema = z.object({
  type: z.enum(["regular", "duplet", "blitz"]),
  number: z.number().nullable(),
  question: questionFieldSchema,
  answer: questionFieldSchema.nullable(),
  zachet: z.string().nullable(),
  nezachet: z.string().nullable(),
  comment: z.string().nullable(),
  source: z.union([z.string(), z.array(z.string())]).nullable(),
  author: z.string().nullable(),
  handoutType: z.enum(["none", "text", "image"]),
  handout: z.string().nullable(),
  handoutImageId: z.string().nullable(),
});

export type QuestionFormData = z.infer<typeof questionFormSchema>;

export type HandoutType = "none" | "text" | "image";
