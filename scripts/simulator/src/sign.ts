/**
 * HMAC signing for synthetic provider requests — identical scheme to the
 * ingestion endpoint (hex HMAC-SHA256 over the RAW body).
 */
import { createHmac } from "node:crypto";

export function hmacSign(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function signedIngestRequest(input: {
  apiBaseUrl: string;
  monitorId: string;
  providerEventId: string;
  payload: unknown;
  secret: string;
}): Request {
  const raw = JSON.stringify(input.payload);
  return new Request(
    `${input.apiBaseUrl.replace(/\/$/, "")}/api/ingest/${input.monitorId}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-provider-event-id": input.providerEventId,
        "x-wirewatch-signature": hmacSign(raw, input.secret),
      },
      body: raw,
    },
  );
}
