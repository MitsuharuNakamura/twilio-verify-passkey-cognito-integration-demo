import { NextRequest, NextResponse } from "next/server";
import { approvePasskeyChallenge } from "@/lib/twilio";
import { initiateCustomAuth, respondToCustomChallenge } from "@/lib/cognito";
import { issueProofToken } from "@/lib/passkey-proof";
import { getSecret } from "@/lib/secrets";
import {
  authCookieOptions,
  refreshCookieOptions,
  deleteCookieOptions,
} from "@/lib/cookies";

export async function POST(req: NextRequest) {
  try {
    const { assertion } = await req.json();
    const email = req.cookies.get("passkey_email")?.value;

    if (!email || !assertion) {
      return NextResponse.json(
        { error: "Missing authentication data" },
        { status: 400 },
      );
    }

    // Verify the WebAuthn assertion with Twilio
    const result = await approvePasskeyChallenge(assertion);

    if (result.status !== "approved") {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 },
      );
    }

    // Issue proof token and exchange via Cognito Custom Auth
    // Initiate Cognito Custom Auth
    const authRes = await initiateCustomAuth(email);
    if (!authRes.Session) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 },
      );
    }

    // Use Cognito's internal USERNAME (UUID) for the proof token
    const cognitoUsername = authRes.ChallengeParameters?.USERNAME ?? email;
    const secret = await getSecret("PASSKEY_PROOF_SECRET");
    const proofToken = issueProofToken(cognitoUsername, secret);

    const challengeRes = await respondToCustomChallenge(
      authRes.Session,
      cognitoUsername,
      proofToken,
    );

    const tokens = challengeRes.AuthenticationResult;
    console.log("Cognito login success:", {
      cognitoUsername,
      hasAccessToken: !!tokens?.AccessToken,
      hasIdToken: !!tokens?.IdToken,
      hasRefreshToken: !!tokens?.RefreshToken,
      tokenType: tokens?.TokenType,
    });
    if (!tokens?.AccessToken || !tokens.IdToken) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 500 },
      );
    }

    const res = NextResponse.json({ success: true });

    res.cookies.set("access_token", tokens.AccessToken, authCookieOptions());
    res.cookies.set("id_token", tokens.IdToken, authCookieOptions());
    if (tokens.RefreshToken) {
      res.cookies.set(
        "refresh_token",
        tokens.RefreshToken,
        refreshCookieOptions(),
      );
    }

    // Clear temp cookies
    res.cookies.set("passkey_email", "", deleteCookieOptions());
    res.cookies.set("passkey_challenge_sid", "", deleteCookieOptions());

    return res;
  } catch (error) {
    console.error("Login complete error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
