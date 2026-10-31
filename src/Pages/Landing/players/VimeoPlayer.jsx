import { useState } from "react";
import PlayerError from "./PlayerError";

function getVimeoEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host !== "vimeo.com" && host !== "player.vimeo.com") return "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    const videoId = host === "player.vimeo.com" ? parts[1] : parts[0];
    const privacyHash = host === "vimeo.com" && /^\d+$/.test(parts[0] || "") ? (parts[1] || parsed.searchParams.get("h") || "") : (parsed.searchParams.get("h") || "");
    if (!/^\d+$/.test(videoId || "")) return "";
    const params = new URLSearchParams({ autoplay: "1", title: "0", byline: "0", portrait: "0", dnt: "1", playsinline: "1" });
    if (privacyHash) params.set("h", privacyHash);
    return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
  } catch {
    return "";
  }
}

export default function VimeoPlayer({ video, className }) {
  const [failed, setFailed] = useState(false);
  const embedUrl = getVimeoEmbedUrl(video.url || video.youtubeUrl || "");
  if (!embedUrl || failed) return <PlayerError className={className} message="Vimeo could not load this video. Check its privacy and embed permissions." url={video.url} />;
  return (
    <iframe
      className={className}
      src={embedUrl}
      title={`${video.title} video player`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      onError={() => setFailed(true)}
    />
  );
}
