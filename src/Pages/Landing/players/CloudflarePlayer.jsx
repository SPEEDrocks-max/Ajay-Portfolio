import PlayerError from "./PlayerError";

export default function CloudflarePlayer({ video, className }) {
  const customerCode = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE;
  const uid = video.playbackId || video.videoId || video.url;
  if (!customerCode || !/^[a-f\d]{16,64}$/i.test(uid || "")) {
    return <PlayerError className={className} message="Cloudflare Stream playback is not configured for this video." url={video.url} />;
  }
  return (
    <iframe
      className={className}
      src={`https://customer-${customerCode}.cloudflarestream.com/${encodeURIComponent(uid)}/iframe?autoplay=true`}
      title={`${video.title || "Video"} video player`}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
