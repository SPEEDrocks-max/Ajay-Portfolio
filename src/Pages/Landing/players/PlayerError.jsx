export default function PlayerError({ message, url, className }) {
  return (
    <div className={`${className} featured-video__player-error`} role="status">
      <p>{message}</p>
      {url && <a href={url} target="_blank" rel="noreferrer">Open video source ↗</a>}
    </div>
  );
}
