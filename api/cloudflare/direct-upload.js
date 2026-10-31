import { jsonResponse, verifyAdminRequest } from "../../server/adminAuth.js";

const MAX_UPLOAD_BYTES = 30 * 1024 * 1024 * 1024;
const TUS_THRESHOLD = 200 * 1024 * 1024;
const MAX_DURATION_SECONDS = 36000;

function encodeMetadata(value) {
  return Buffer.from(String(value), "utf8").toString("base64");
}

export async function POST(request) {
  const auth = await verifyAdminRequest(request);
  if (auth.error) return jsonResponse({ error: auth.error }, auth.status);

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return jsonResponse({ error: "Cloudflare Stream is not configured yet. Add the server-only account ID and API token in Vercel project settings." }, 503);

  const body = await request.json().catch(() => null);
  const fileSize = Number(body?.fileSize);
  const fileName = String(body?.fileName || "").replace(/[\r\n]/g, "").slice(0, 180);
  const fileType = String(body?.fileType || "").toLowerCase();
  if (!Number.isSafeInteger(fileSize) || fileSize < 1 || fileSize > MAX_UPLOAD_BYTES) return jsonResponse({ error: "The selected file size is invalid or exceeds the 30 GB Stream limit." }, 400);
  const expectedType = /\.mp4$/i.test(fileName) ? "video/mp4" : /\.mov$/i.test(fileName) ? "video/quicktime" : /\.webm$/i.test(fileName) ? "video/webm" : "";
  if (!expectedType || fileType !== expectedType) return jsonResponse({ error: "Choose an MP4, MOV, or WebM video with a matching file type." }, 400);

  const accountApi = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream`;
  const isTus = fileSize > TUS_THRESHOLD;
  let cloudflareResponse;
  try {
    if (isTus) {
      const expiry = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      const metadata = [
        `maxDurationSeconds ${encodeMetadata(MAX_DURATION_SECONDS)}`,
        `expiry ${encodeMetadata(expiry)}`,
        `name ${encodeMetadata(fileName)}`,
      ].join(",");
      cloudflareResponse = await fetch(`${accountApi}?direct_user=true`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Tus-Resumable": "1.0.0",
          "Upload-Length": String(fileSize),
          "Upload-Metadata": metadata,
          "Upload-Creator": auth.user.id,
        },
      });
      const uploadUrl = cloudflareResponse.headers.get("Location");
      const uid = cloudflareResponse.headers.get("stream-media-id");
      if (!cloudflareResponse.ok || !uploadUrl || !uid) {
        const responseBody = await cloudflareResponse.json().catch(() => null);
        const message = responseBody?.errors?.map((entry) => entry.message).filter(Boolean).join(" ");
        return jsonResponse({ error: message || "Cloudflare could not create a resumable upload link." }, 502);
      }
      return jsonResponse({ protocol: "tus", uploadUrl, uid });
    }

    const origin = new URL(request.url).hostname;
    cloudflareResponse = await fetch(`${accountApi}/direct_upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ maxDurationSeconds: MAX_DURATION_SECONDS, creator: auth.user.id, allowedOrigins: [origin], meta: { name: fileName } }),
    });
    const responseBody = await cloudflareResponse.json().catch(() => null);
    if (!cloudflareResponse.ok || !responseBody?.success || !responseBody?.result?.uploadURL || !responseBody?.result?.uid) {
      const message = responseBody?.errors?.map((entry) => entry.message).filter(Boolean).join(" ");
      return jsonResponse({ error: message || "Cloudflare could not create an upload link." }, 502);
    }
    return jsonResponse({ protocol: "post", uploadUrl: responseBody.result.uploadURL, uid: responseBody.result.uid });
  } catch {
    return jsonResponse({ error: "Could not connect to Cloudflare Stream. No upload was reported as successful." }, 502);
  }
}
