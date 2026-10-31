import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getYouTubeId, getYouTubeThumbnailCandidates } from "../Work/projects";
import "./FeaturedVideoCard.css";

const VideoPlayer = lazy(() => import("./VideoPlayer"));

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

export default function FeaturedVideoCard({ video }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [posterIndex, setPosterIndex] = useState(0);
  const sourceUrl = video.url || video.youtubeUrl || "";
  const provider = video.provider || inferProvider(sourceUrl || video.youtubeUrl || "");
  const cloudflareId = provider === "cloudflare"
    ? video.playbackId || video.videoId || sourceUrl.match(/cloudflarestream\.com\/([a-f\d]{16,64})/i)?.[1] || (/^[a-f\d]{16,64}$/i.test(sourceUrl) ? sourceUrl : "")
    : "";
  const videoId = provider === "youtube" ? getYouTubeId(sourceUrl) : provider === "cloudflare" ? cloudflareId : video.playbackId || "";
  const posterSource = video.thumbnail || video.poster;
  const posterCandidates = (() => {
    const sourceCandidates = [];
    if (provider === "youtube" && videoId) sourceCandidates.push(...getYouTubeThumbnailCandidates(videoId));
    if (provider === "vimeo") {
      const vimeoId = sourceUrl.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1];
      if (vimeoId) sourceCandidates.push(`https://vumbnail.com/${vimeoId}_large.jpg`, `https://vumbnail.com/${vimeoId}.jpg`);
    }
    if (provider === "googleDrive" || provider === "google_drive") {
      const driveId = sourceUrl.match(/\/file\/d\/([^/?]+)/)?.[1] || sourceUrl.match(/[?&]id=([^&]+)/)?.[1];
      if (driveId) {
        const safeDriveId = encodeURIComponent(decodeURIComponent(driveId));
        sourceCandidates.push(`https://drive.google.com/thumbnail?id=${safeDriveId}&sz=w1280`, `https://lh3.googleusercontent.com/d/${safeDriveId}=w1280`);
      }
    }
    if (provider === "cloudflare" && videoId) {
      const customerCode = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE;
      if (customerCode) sourceCandidates.push(`https://customer-${customerCode}.cloudflarestream.com/${videoId}/thumbnails/thumbnail.jpg`);
    }
    const uploadedCandidates = posterSource ? [posterSource] : [];
    return [...new Set(video.sourceThumbnailFirst ? [...sourceCandidates, ...uploadedCandidates] : [...uploadedCandidates, ...sourceCandidates])];
  })();
  const posterUrl = posterCandidates[posterIndex] || "";

  useEffect(() => {
    setPosterIndex(0);
    setPosterFailed(false);
  }, [sourceUrl, posterSource, provider, videoId]);

  useEffect(() => {
    if (!isPlaying) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => { if (event.key === "Escape") setIsPlaying(false); };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying]);

  function handlePosterError() {
    if (posterIndex < posterCandidates.length - 1) setPosterIndex((currentIndex) => currentIndex + 1);
    else setPosterFailed(true);
  }

  return (
    <article className="featured-video">
      <div className="featured-video__media">
        {posterFailed || !posterUrl ? (
          <div className="featured-video__poster-fallback" aria-label={`${video.title || "Video"} thumbnail unavailable`}><span>{video.title || "VIDEO"}</span></div>
        ) : (
          <img className="featured-video__poster" src={posterUrl} sizes="(max-width: 700px) 100vw, 70vw" width="1280" height="720" alt="" loading="lazy" decoding="async" onError={handlePosterError} />
        )}
        <button className="featured-video__play" type="button" onClick={() => setIsPlaying(true)} aria-label={`Play ${video.title || "video"}`} />
      </div>
      {(video.title || video.client || video.year || video.description) && <div className="featured-video__caption"><span>{[video.client, video.year].filter(Boolean).join(" · ")}</span>{video.title && <strong>{video.title}</strong>}{video.description && <small>{video.description}</small>}</div>}
      {isPlaying && createPortal(
        <div className="video-player-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsPlaying(false); }}>
          <section className="video-player-modal__dialog" role="dialog" aria-modal="true" aria-label={`${video.title || "Video"} player`}>
            <button className="featured-video__close video-player-modal__close" type="button" onClick={() => setIsPlaying(false)} aria-label={`Close ${video.title || "video"}`}>×</button>
            <Suspense fallback={<div className="featured-video__player featured-video__player-loading" role="status">Loading video…</div>}>
              <VideoPlayer video={{ ...video, provider, videoId, playbackId: video.playbackId || (provider === "cloudflare" ? cloudflareId : videoId) }} className="featured-video__player" />
            </Suspense>
          </section>
        </div>,
        document.body,
      )}
    </article>
  );
}
