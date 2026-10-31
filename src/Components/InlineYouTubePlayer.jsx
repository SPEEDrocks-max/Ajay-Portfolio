export default function InlineYouTubePlayer({ videoId, title, className, embedUrl }) {
  const safeFallbackUrl = /^[\w-]{6,20}$/.test(videoId || "")
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&controls=1&playsinline=1&rel=0`
    : "about:blank";
  return (
    <iframe
      className={className}
      src={embedUrl || safeFallbackUrl}
      title={`${title} video player`}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}
