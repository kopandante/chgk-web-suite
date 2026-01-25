import { z } from "zod";

// Package metadata schema
export const packageSchema = z.object({
  title: z.string().min(1, "Название обязательно"),
  editor: z.string().optional(),
  date: z.string().optional(),
});

export type PackageFormData = z.infer<typeof packageSchema>;

// Question schema
export const questionSchema = z.object({
  id: z.string(),
  number: z.number().nullable(),
  question: z.string().min(1, "Текст вопроса обязателен"),
  answer: z.string().nullable(),
  zachet: z.string().nullable(),
  nezachet: z.string().nullable(),
  comment: z.string().nullable(),
  source: z.string().nullable(),
  author: z.string().nullable(),
  handout: z.string().nullable(),
  isNew: z.boolean().optional(),
  isDeleted: z.boolean().optional(),
});

export type QuestionFormData = z.infer<typeof questionSchema>;

// Full edit form schema
export const editPackageSchema = z.object({
  title: z.string().min(1, "Название обязательно"),
  editor: z.string(),
  date: z.string(),
  questions: z.array(questionSchema),
});

export type EditPackageFormData = z.infer<typeof editPackageSchema>;
