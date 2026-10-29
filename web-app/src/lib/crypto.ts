/**
 * Web Crypto API HMAC-SHA256 Challenge-Response Authentication
 * Guarantees zero plaintext PIN transmission over signaling or WebRTC channels.
 */

export function generateSalt(byteLength: number = 16): string {
  const bytes = new Uint8Array(byteLength);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeHmac(pin: string, saltHex: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(pin.trim());
  const saltData = encoder.encode(saltHex);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await window.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    saltData
  );

  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyHmac(
  pin: string,
  saltHex: string,
  providedHmacHex: string
): Promise<boolean> {
  try {
    const expectedHmac = await computeHmac(pin, saltHex);
    // Constant-time comparison to prevent timing attacks
    if (expectedHmac.length !== providedHmacHex.length) {
      return false;
    }
    let mismatch = 0;
    for (let i = 0; i < expectedHmac.length; i++) {
      mismatch |= expectedHmac.charCodeAt(i) ^ providedHmacHex.charCodeAt(i);
    }
    return mismatch === 0;
  } catch (err) {
    console.error("HMAC verification failed:", err);
    return false;
  }
}

