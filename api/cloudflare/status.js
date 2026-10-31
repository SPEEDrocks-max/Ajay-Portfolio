import { jsonResponse, verifyAdminRequest } from "../../server/adminAuth.js";

export async function POST(request) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return jsonResponse({ error: "Cloudflare Stream server credentials are not configured." }, 503);

  const body = await request.json().catch(() => null);
  const uid = String(body?.uid || "");
  if (!/^[a-f\d]{16,64}$/i.test(uid)) return jsonResponse({ error: "The Cloudflare video ID is invalid." }, 400);

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success || !payload?.result) {
      const message = payload?.errors?.map((entry) => entry.message).filter(Boolean).join(" ");
      return jsonResponse({ error: message || "Cloudflare could not return this video's status." }, 502);
    }
    const stream = payload.result;
    return jsonResponse({ readyToStream: Boolean(stream.readyToStream), state: stream.status?.state || "processing", thumbnail: stream.thumbnail || "" });
  } catch {
    return jsonResponse({ error: "Could not connect to Cloudflare Stream." }, 502);
  }
}
