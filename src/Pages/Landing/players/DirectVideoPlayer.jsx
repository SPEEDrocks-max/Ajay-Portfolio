import { useEffect, useRef, useState } from "react";
import PlayerError from "./PlayerError";

export default function DirectVideoPlayer({ video, className }) {
  const playerRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => () => {
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    player.removeAttribute("src");
    player.load();
  }, []);

  if (failed) return <PlayerError className={className} message="This video file could not be played." url={video.url} />;
  return (
    <video
      ref={playerRef}
      className={className}
      src={video.url}
      poster={video.poster || video.thumbnail || undefined}
      controls
      autoPlay
      playsInline
      preload="none"
      onError={() => setFailed(true)}
    />
  );
}
