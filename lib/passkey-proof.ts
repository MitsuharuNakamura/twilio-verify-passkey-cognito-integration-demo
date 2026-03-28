import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_SEC = 30;

export function issueProofToken(userId: string, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
  const payload = `${userId}:${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}:${sig}`;
}

export function verifyProofToken(
  token: string,
  secret: string,
): string | null {
  const parts = token.split(":");
  if (parts.length !== 3) return null;

  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (Number.isNaN(exp)) return null;

  // Check expiration
  if (exp < Math.floor(Date.now() / 1000)) return null;

  // Verify HMAC
  const payload = `${userId}:${expStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");

  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

  return userId;
}
