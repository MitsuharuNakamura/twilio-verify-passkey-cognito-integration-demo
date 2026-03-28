import type { DefineAuthChallengeTriggerEvent } from "aws-lambda";

export const handler = async (
  event: DefineAuthChallengeTriggerEvent,
): Promise<DefineAuthChallengeTriggerEvent> => {
  const sessions = event.request.session;

  if (sessions.length === 0) {
    // First attempt: issue a custom challenge
    event.response.challengeName = "CUSTOM_CHALLENGE";
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
  } else if (sessions.at(-1)!.challengeResult === true) {
    // Challenge succeeded: issue tokens
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    // Challenge failed
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }

  return event;
};
