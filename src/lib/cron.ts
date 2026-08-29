import "server-only";

import { timingSafeEqual } from "node:crypto";

export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const actual = Buffer.from(header.slice(7));
  const expected = Buffer.from(secret);
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}
