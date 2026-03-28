import type { CreateAuthChallengeTriggerEvent } from "aws-lambda";
import crypto from "crypto";

export const handler = async (
  event: CreateAuthChallengeTriggerEvent,
): Promise<CreateAuthChallengeTriggerEvent> => {
  const nonce = crypto.randomUUID();
  event.response.publicChallengeParameters = { nonce };
  event.response.privateChallengeParameters = { nonce };

  return event;
};
