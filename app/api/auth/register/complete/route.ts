import { NextRequest, NextResponse } from "next/server";
import { verifyPasskeyFactor } from "@/lib/twilio";
import { createCognitoUser, initiateCustomAuth, respondToCustomChallenge } from "@/lib/cognito";
import { issueProofToken } from "@/lib/passkey-proof";
import { getSecret } from "@/lib/secrets";
import {
  authCookieOptions,
  refreshCookieOptions,
  deleteCookieOptions,
} from "@/lib/cookies";

export async function POST(req: NextRequest) {
  try {
    const { credential } = await req.json();
    const email = req.cookies.get("passkey_email")?.value;

    if (!email || !credential) {
      return NextResponse.json(
        { error: "Missing registration data" },
        { status: 400 },
      );
    }

    // Verify factor via Passkeys API
    const result = await verifyPasskeyFactor(credential);

    if (result.status !== "verified") {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 },
      );
    }

    // Create Cognito user (email as username)
    await createCognitoUser(email);

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
    console.log("Cognito auth success:", {
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

    // Set auth cookies
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
    res.cookies.set("passkey_factor_sid", "", deleteCookieOptions());

    return res;
  } catch (error) {
    console.error("Register complete error:", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 },
    );
  }
}
