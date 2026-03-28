import { NextRequest, NextResponse } from "next/server";
import { createPasskeyChallenge, toTwilioIdentity } from "@/lib/twilio";
import { tempCookieOptions } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 },
      );
    }

    const identity = toTwilioIdentity(email);
    const challenge = await createPasskeyChallenge(identity);

    const res = NextResponse.json({
      challengeSid: challenge.sid,
      authenticationOptions: challenge.options?.publicKey ?? challenge.options,
    });

    res.cookies.set("passkey_email", email, tempCookieOptions());
    res.cookies.set("passkey_challenge_sid", challenge.sid, tempCookieOptions());

    return res;
  } catch (error) {
    console.error("Login start error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
