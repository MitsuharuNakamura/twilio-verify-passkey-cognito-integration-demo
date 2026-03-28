import { NextRequest, NextResponse } from "next/server";
import { createPasskeyFactor, toTwilioIdentity } from "@/lib/twilio";
import { tempCookieOptions } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const identity = toTwilioIdentity(email);

    // Create Passkey Factor (returns WebAuthn creation options)
    const factor = await createPasskeyFactor(identity, `passkey-${email}`);

    const res = NextResponse.json({
      factorSid: factor.sid,
      registrationOptions: factor.options.publicKey,
    });

    // Store email and factor SID in cookies for the complete step
    res.cookies.set("passkey_email", email, tempCookieOptions());
    res.cookies.set("passkey_factor_sid", factor.sid, tempCookieOptions());

    return res;
  } catch (error) {
    console.error("Register start error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 },
    );
  }
}
