import { createHash } from "crypto";
import { getSecret } from "./secrets";

/** Twilio identity は英数字とハイフンのみ許可。メールをSHA256ハッシュに変換する */
export function toTwilioIdentity(email: string): string {
  return createHash("sha256").update(email.toLowerCase()).digest("hex");
}

const BASE = "https://verify.twilio.com";

async function twilioFetch(path: string, body: Record<string, unknown>) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken = await getSecret("TWILIO_AUTH_TOKEN");

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("Twilio API error response:", errBody);
    const err = JSON.parse(errBody || "{}");
    throw new Error(
      `Twilio API error ${res.status}: ${err.message || res.statusText}`,
    );
  }

  return res.json();
}

function servicePath() {
  return `/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID!}`;
}

// --- Registration ---

export async function createPasskeyFactor(
  identity: string,
  friendlyName: string,
) {
  // POST /v2/Services/{ServiceSid}/Passkeys/Factors
  const data = await twilioFetch(`${servicePath()}/Passkeys/Factors`, {
    identity,
    friendly_name: friendlyName,
  });
  // data.sid = Factor SID (YF...)
  // data.options = WebAuthn PublicKeyCredentialCreationOptions
  return data;
}

export async function verifyPasskeyFactor(credential: object) {
  // POST /v2/Services/{ServiceSid}/Passkeys/VerifyFactor
  const data = await twilioFetch(
    `${servicePath()}/Passkeys/VerifyFactor`,
    credential as Record<string, unknown>,
  );
  return data;
}

export async function approvePasskeyChallenge(credential: object) {
  // POST /v2/Services/{ServiceSid}/Passkeys/ApproveChallenge
  const data = await twilioFetch(
    `${servicePath()}/Passkeys/ApproveChallenge`,
    credential,
  );
  return data;
}

// --- Authentication ---

export async function createPasskeyChallenge(identity: string) {
  // POST /v2/Services/{ServiceSid}/Passkeys/Challenges
  const data = await twilioFetch(`${servicePath()}/Passkeys/Challenges`, {
    identity,
  });
  // data.sid = Challenge SID (YC...)
  // data.options = WebAuthn PublicKeyCredentialRequestOptions
  return data;
}
