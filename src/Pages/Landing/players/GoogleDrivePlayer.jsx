import { useState } from "react";
import PlayerError from "./PlayerError";

function getDrivePreviewUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/^(drive|docs)\.google\.com$/.test(parsed.hostname)) return "";
    const fileId = parsed.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || parsed.searchParams.get("id");
    if (!fileId || !/^[\w-]+$/.test(fileId)) return "";
    return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
  } catch {
    return "";
  }
}

export default function GoogleDrivePlayer({ video, className }) {
  const [failed, setFailed] = useState(false);
  const previewUrl = getDrivePreviewUrl(video.url || video.youtubeUrl || "");
  if (!previewUrl || failed) return <PlayerError className={className} message="Google Drive could not load this video. Check that sharing is set to public viewing." url={video.url} />;
  return (
    <iframe
      className={className}
      src={previewUrl}
      title={`${video.title} video player`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      onError={() => setFailed(true)}
    />
  );
}
