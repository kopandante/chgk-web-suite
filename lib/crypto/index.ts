// E2E encryption utilities using Web Crypto API

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function generateIv(): Uint8Array {
  return generateRandomBytes(12);
}

export function generateSalt(): Uint8Array {
  return generateRandomBytes(16);
}

export async function generateAesKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations = 600000,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  );
}

export async function encryptData(
  key: CryptoKey,
  data: string | ArrayBuffer,
): Promise<{ ciphertext: ArrayBuffer; iv: Uint8Array }> {
  const iv = generateIv();
  const encoder = new TextEncoder();
  const plaintext = typeof data === "string" ? encoder.encode(data) : data;

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    plaintext,
  );

  return { ciphertext, iv };
}

export async function decryptData(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
): Promise<ArrayBuffer> {
  return await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    ciphertext,
  );
}

export async function decryptDataToString(
  key: CryptoKey,
  ciphertext: ArrayBuffer,
  iv: Uint8Array,
): Promise<string> {
  const decrypted = await decryptData(key, ciphertext, iv);
  return new TextDecoder().decode(decrypted);
}

export async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey,
): Promise<{ wrappedKey: ArrayBuffer; iv: Uint8Array }> {
  const iv = generateIv();
  const wrappedKey = await crypto.subtle.wrapKey("raw", keyToWrap, wrappingKey, {
    name: "AES-GCM",
    iv: iv.buffer as ArrayBuffer,
  });
  return { wrappedKey, iv };
}

export async function unwrapKey(
  wrappedKey: ArrayBuffer,
  unwrappingKey: CryptoKey,
  iv: Uint8Array,
): Promise<CryptoKey> {
  return await crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    unwrappingKey,
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return await crypto.subtle.exportKey("raw", key);
}

export async function importKey(keyData: ArrayBuffer): Promise<CryptoKey> {
  return await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

// ECDH for key exchange

export async function generateEcdhKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
    "deriveBits",
  ]);
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey("jwk", publicKey);
}

export async function exportPrivateKey(privateKey: CryptoKey): Promise<JsonWebKey> {
  return await crypto.subtle.exportKey("jwk", privateKey);
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, []);
}

export async function importPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return await crypto.subtle.importKey("jwk", jwk, { name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveKey",
    "deriveBits",
  ]);
}

export async function deriveSharedSecret(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<CryptoKey> {
  return await crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  );
}

// High-level functions

export interface EncryptedData {
  ciphertext: string;
  iv: string;
}

export async function encrypt(key: CryptoKey, data: unknown): Promise<EncryptedData> {
  const json = JSON.stringify(data);
  const { ciphertext, iv } = await encryptData(key, json);
  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

export async function decrypt<T = unknown>(key: CryptoKey, encrypted: EncryptedData): Promise<T> {
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  const json = await decryptDataToString(key, ciphertext, iv);
  return JSON.parse(json) as T;
}

export async function encryptBinary(key: CryptoKey, data: ArrayBuffer): Promise<EncryptedData> {
  const { ciphertext, iv } = await encryptData(key, data);
  return {
    ciphertext: arrayBufferToBase64(ciphertext),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  };
}

export async function decryptBinary(
  key: CryptoKey,
  encrypted: EncryptedData,
): Promise<ArrayBuffer> {
  const ciphertext = base64ToArrayBuffer(encrypted.ciphertext);
  const iv = new Uint8Array(base64ToArrayBuffer(encrypted.iv));
  return await decryptData(key, ciphertext, iv);
}
