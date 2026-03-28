import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import crypto from "crypto";

const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

const userPoolId = () => process.env.COGNITO_USER_POOL_ID!;
const clientId = () => process.env.COGNITO_CLIENT_ID!;

export async function createCognitoUser(email: string) {
  try {
    // Step 1: Create user (suppress invitation email)
    await client.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId(),
        Username: email,
        MessageAction: "SUPPRESS",
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
      }),
    );

    // Step 2: Set permanent random password to avoid FORCE_CHANGE_PASSWORD
    await client.send(
      new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId(),
        Username: email,
        Password: crypto.randomUUID() + "Aa1!",
        Permanent: true,
      }),
    );
  } catch (e: any) {
    if (e.name === "UsernameExistsException") return;
    throw e;
  }
}

export async function initiateCustomAuth(email: string) {
  const res = await client.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId(),
      ClientId: clientId(),
      AuthFlow: "CUSTOM_AUTH",
      AuthParameters: {
        USERNAME: email,
      },
    }),
  );
  return res;
}

export async function respondToCustomChallenge(
  session: string,
  email: string,
  answer: string,
) {
  const res = await client.send(
    new AdminRespondToAuthChallengeCommand({
      UserPoolId: userPoolId(),
      ClientId: clientId(),
      ChallengeName: "CUSTOM_CHALLENGE",
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        ANSWER: answer,
      },
    }),
  );
  return res;
}
