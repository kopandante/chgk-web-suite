// Encrypted database client using Convex
// All data is encrypted/decrypted on the client using the master key

import type { Id } from "@/convex/_generated/dataModel";
import { decrypt, type EncryptedData, encrypt } from "@/lib/crypto";

// Types for decrypted data (matching the old schema interface)
export interface Package {
  id: Id<"packages">;
  title: string;
  editor: string | null;
  date: string | null;
  question_count: number;
  tour_count: number;
  created_at: number;
  updated_at: number;
}

export interface Tour {
  id: Id<"tours">;
  package_id: Id<"packages">;
  title: string | null;
  order_num: number;
  created_at: number;
}

export interface Question {
  id: Id<"questions">;
  package_id: Id<"packages">;
  tour_id: Id<"tours"> | null;
  order_num: number;
  number: number | null;
  question: string;
  answer: string | null;
  zachet: string | null;
  nezachet: string | null;
  comment: string | null;
  source: string | null;
  author: string | null;
  handout: string | null;
  created_at: number;
}

export interface Image {
  id: Id<"images">;
  question_id: Id<"questions">;
  url: string; // URL to encrypted file in Convex Storage
  iv: string; // IV for decryption
  content_type: string;
  filename: string | null;
  created_at: number;
}

// Encrypted data types (stored in Convex)
interface PackageData {
  title: string;
  editor: string | null;
  date: string | null;
}

interface TourData {
  title: string | null;
}

interface QuestionData {
  number: number | null;
  question: string;
  answer: string | null;
  zachet: string | null;
  nezachet: string | null;
  comment: string | null;
  source: string | null;
  author: string | null;
  handout: string | null;
}

// Convex document types (from queries)
interface ConvexPackage {
  _id: Id<"packages">;
  userId: string;
  encryptedData: string;
  iv: string;
  questionCount: number;
  tourCount: number;
  createdAt: number;
  updatedAt: number;
}

interface ConvexTour {
  _id: Id<"tours">;
  userId: string;
  packageId: Id<"packages">;
  encryptedData: string;
  iv: string;
  orderNum: number;
  createdAt: number;
}

interface ConvexQuestion {
  _id: Id<"questions">;
  userId: string;
  packageId: Id<"packages">;
  tourId?: Id<"tours">;
  encryptedData: string;
  iv: string;
  orderNum: number;
  createdAt: number;
}

interface ConvexImage {
  _id: Id<"images">;
  userId: string;
  questionId: Id<"questions">;
  storageId: Id<"_storage">;
  iv: string;
  url: string | null; // Added by query
  contentType: string;
  filename?: string;
  createdAt: number;
}

// Decrypt functions
export async function decryptPackage(masterKey: CryptoKey, pkg: ConvexPackage): Promise<Package> {
  const data = await decrypt<PackageData>(masterKey, {
    ciphertext: pkg.encryptedData,
    iv: pkg.iv,
  });

  return {
    id: pkg._id,
    title: data.title,
    editor: data.editor,
    date: data.date,
    question_count: pkg.questionCount,
    tour_count: pkg.tourCount,
    created_at: pkg.createdAt,
    updated_at: pkg.updatedAt,
  };
}

export async function decryptPackages(
  masterKey: CryptoKey,
  packages: ConvexPackage[],
): Promise<Package[]> {
  return Promise.all(packages.map((pkg) => decryptPackage(masterKey, pkg)));
}

export async function decryptTour(masterKey: CryptoKey, tour: ConvexTour): Promise<Tour> {
  const data = await decrypt<TourData>(masterKey, {
    ciphertext: tour.encryptedData,
    iv: tour.iv,
  });

  return {
    id: tour._id,
    package_id: tour.packageId,
    title: data.title,
    order_num: tour.orderNum,
    created_at: tour.createdAt,
  };
}

export async function decryptTours(masterKey: CryptoKey, tours: ConvexTour[]): Promise<Tour[]> {
  return Promise.all(tours.map((tour) => decryptTour(masterKey, tour)));
}

export async function decryptQuestion(
  masterKey: CryptoKey,
  question: ConvexQuestion,
): Promise<Question> {
  const data = await decrypt<QuestionData>(masterKey, {
    ciphertext: question.encryptedData,
    iv: question.iv,
  });

  return {
    id: question._id,
    package_id: question.packageId,
    tour_id: question.tourId ?? null,
    order_num: question.orderNum,
    number: data.number,
    question: data.question,
    answer: data.answer,
    zachet: data.zachet,
    nezachet: data.nezachet,
    comment: data.comment,
    source: data.source,
    author: data.author,
    handout: data.handout,
    created_at: question.createdAt,
  };
}

export async function decryptQuestions(
  masterKey: CryptoKey,
  questions: ConvexQuestion[],
): Promise<Question[]> {
  return Promise.all(questions.map((q) => decryptQuestion(masterKey, q)));
}

// Map image from Convex (decryption happens when fetching the file)
export function mapImage(image: ConvexImage): Image {
  return {
    id: image._id,
    question_id: image.questionId,
    url: image.url ?? "",
    iv: image.iv,
    content_type: image.contentType,
    filename: image.filename ?? null,
    created_at: image.createdAt,
  };
}

export function mapImages(images: ConvexImage[]): Image[] {
  return images.map(mapImage);
}

// Decrypt image binary data fetched from URL
export async function decryptImageData(
  masterKey: CryptoKey,
  encryptedData: ArrayBuffer,
  iv: string,
): Promise<ArrayBuffer> {
  const { decryptBinary } = await import("@/lib/crypto");
  return decryptBinary(masterKey, {
    ciphertext: arrayBufferToBase64(encryptedData),
    iv,
  });
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Encrypt functions
export async function encryptPackageData(
  masterKey: CryptoKey,
  data: PackageData,
): Promise<EncryptedData> {
  return encrypt(masterKey, data);
}

export async function encryptTourData(
  masterKey: CryptoKey,
  data: TourData,
): Promise<EncryptedData> {
  return encrypt(masterKey, data);
}

export async function encryptQuestionData(
  masterKey: CryptoKey,
  data: QuestionData,
): Promise<EncryptedData> {
  return encrypt(masterKey, data);
}

// Encrypt image binary data for upload to Convex Storage
export async function encryptImageBinary(
  masterKey: CryptoKey,
  data: ArrayBuffer,
): Promise<{ encryptedBlob: Blob; iv: string }> {
  const { encryptBinary } = await import("@/lib/crypto");
  const encrypted = await encryptBinary(masterKey, data);

  // Convert base64 ciphertext to Blob for upload
  const binary = atob(encrypted.ciphertext);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return {
    encryptedBlob: new Blob([bytes], { type: "application/octet-stream" }),
    iv: encrypted.iv,
  };
}

// Helper to prepare package creation data
export async function preparePackageCreate(
  masterKey: CryptoKey,
  data: { title: string; editor?: string; date?: string },
): Promise<{ encryptedData: string; iv: string }> {
  const packageData: PackageData = {
    title: data.title,
    editor: data.editor ?? null,
    date: data.date ?? null,
  };
  const encrypted = await encryptPackageData(masterKey, packageData);
  return {
    encryptedData: encrypted.ciphertext,
    iv: encrypted.iv,
  };
}

// Helper to prepare tour creation data
export async function prepareTourCreate(
  masterKey: CryptoKey,
  data: { title?: string },
): Promise<{ encryptedData: string; iv: string }> {
  const tourData: TourData = {
    title: data.title ?? null,
  };
  const encrypted = await encryptTourData(masterKey, tourData);
  return {
    encryptedData: encrypted.ciphertext,
    iv: encrypted.iv,
  };
}

// Helper to prepare question creation data
export async function prepareQuestionCreate(
  masterKey: CryptoKey,
  data: Omit<QuestionData, "number"> & { number?: number },
): Promise<{ encryptedData: string; iv: string }> {
  const questionData: QuestionData = {
    number: data.number ?? null,
    question: data.question,
    answer: data.answer ?? null,
    zachet: data.zachet ?? null,
    nezachet: data.nezachet ?? null,
    comment: data.comment ?? null,
    source: data.source ?? null,
    author: data.author ?? null,
    handout: data.handout ?? null,
  };
  const encrypted = await encryptQuestionData(masterKey, questionData);
  return {
    encryptedData: encrypted.ciphertext,
    iv: encrypted.iv,
  };
}
