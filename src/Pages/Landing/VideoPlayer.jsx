import { lazy, Suspense } from "react";
import InlineYouTubePlayer from "../../Components/InlineYouTubePlayer";
import { getYouTubeId } from "../Work/projects";
import PlayerError from "./players/PlayerError";

const VimeoPlayer = lazy(() => import("./players/VimeoPlayer"));
const GoogleDrivePlayer = lazy(() => import("./players/GoogleDrivePlayer"));
const DirectVideoPlayer = lazy(() => import("./players/DirectVideoPlayer"));
const CloudflarePlayer = lazy(() => import("./players/CloudflarePlayer"));

function inferProvider(url = "") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be" || host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtube-nocookie.com") return "youtube";
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) return "vimeo";
    if (host === "drive.google.com" || host === "docs.google.com") return "google_drive";
    if (host.endsWith("cloudflarestream.com")) return "cloudflare";
    if (/\.(mp4|webm|mov|m3u8)$/i.test(parsed.pathname)) return "direct";
  } catch { return ""; }
  return "";
}

export default function VideoPlayer({ video, className }) {
  const url = video.url || video.youtubeUrl || "";
  const provider = video.provider || inferProvider(url);

  if (provider === "youtube") {
    const videoId = getYouTubeId(url) || video.id;
    if (!/^[\w-]{6,20}$/.test(videoId || "")) {
      return <PlayerError className={className} message="This YouTube link is invalid." url={url} />;
    }
    return <InlineYouTubePlayer className={className} videoId={videoId} title={video.title} />;
  }

  if (provider === "vimeo") {
    return <Suspense fallback={<div className={className} role="status">Loading video…</div>}><VimeoPlayer video={video} className={className} /></Suspense>;
  }

  if (provider === "googleDrive" || provider === "google_drive") {
    return <Suspense fallback={<div className={className} role="status">Loading video…</div>}><GoogleDrivePlayer video={video} className={className} /></Suspense>;
  }

  if (provider === "direct") {
    return <Suspense fallback={<div className={className} role="status">Loading video…</div>}><DirectVideoPlayer video={video} className={className} /></Suspense>;
  }

  if (provider === "cloudflare") {
    return <Suspense fallback={<div className={className} role="status">Loading video…</div>}><CloudflarePlayer video={video} className={className} /></Suspense>;
  }

  return <PlayerError className={className} message="This video provider is not supported." url={url} />;
}
