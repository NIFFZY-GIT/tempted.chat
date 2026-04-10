const encoder = new TextEncoder();
const decoder = new TextDecoder();

const E2EE_INFO = encoder.encode("temptedchat-e2ee-v1");

export type EncryptedPayload = {
  ciphertext: string;
  iv: string;
};

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000;

  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }

  return btoa(binary);
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};

export const generateE2EEKeyPair = async (): Promise<CryptoKeyPair> => {
  return window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits"],
  );
};

export const exportPublicJwk = async (key: CryptoKey): Promise<JsonWebKey> => {
  return window.crypto.subtle.exportKey("jwk", key);
};

export const exportPrivateJwk = async (key: CryptoKey): Promise<JsonWebKey> => {
  return window.crypto.subtle.exportKey("jwk", key);
};

export const importPublicJwk = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    [],
  );
};

export const importPrivateJwk = async (jwk: JsonWebKey): Promise<CryptoKey> => {
  return window.crypto.subtle.importKey(
    "jwk",
    jwk,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveBits"],
  );
};

export const deriveRoomKey = async (
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey,
  roomId: string,
): Promise<CryptoKey> => {
  const sharedBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: peerPublicKey,
    },
    privateKey,
    256,
  );

  const hkdfMaterial = await window.crypto.subtle.importKey("raw", sharedBits, "HKDF", false, ["deriveKey"]);

  return window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode(roomId),
      info: E2EE_INFO,
    },
    hkdfMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
};

export const encryptString = async (key: CryptoKey, value: string): Promise<EncryptedPayload> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoder.encode(value),
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
};

export const decryptString = async (key: CryptoKey, payload: EncryptedPayload): Promise<string> => {
  const ivBytes = base64ToBytes(payload.iv);
  const cipherBytes = base64ToBytes(payload.ciphertext);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(ivBytes),
    },
    key,
    toArrayBuffer(cipherBytes),
  );

  return decoder.decode(decrypted);
};

export const encryptBytes = async (key: CryptoKey, bytes: Uint8Array): Promise<EncryptedPayload> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    toArrayBuffer(bytes),
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    iv: bytesToBase64(iv),
  };
};

export const decryptBytes = async (key: CryptoKey, payload: EncryptedPayload): Promise<Uint8Array> => {
  const ivBytes = base64ToBytes(payload.iv);
  const cipherBytes = base64ToBytes(payload.ciphertext);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(ivBytes),
    },
    key,
    toArrayBuffer(cipherBytes),
  );

  return new Uint8Array(decrypted);
};

export const payloadBase64ToBytes = (ciphertext: string): Uint8Array => base64ToBytes(ciphertext);
