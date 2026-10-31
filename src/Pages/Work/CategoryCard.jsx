import { useState } from "react";
import { getYouTubeId, getYouTubeThumbnailCandidates } from "./projects";
import "./CategoryCard.css";

export default function CategoryCard({ category, index, onOpen }) {
  const candidateImages = [
    category.thumbnail,
    category.thumbnailUrl,
    ...(category.videos || []).flatMap((video) => {
      if (video.thumbnail || video.poster) return [video.thumbnail || video.poster];
      const videoId = getYouTubeId(video.youtubeUrl || video.url || "");
      return getYouTubeThumbnailCandidates(videoId);
    }),
  ].filter((url, imageIndex, images) => typeof url === "string" && url.trim() && images.indexOf(url) === imageIndex);
  const [imageIndex, setImageIndex] = useState(0);
  const imageUrl = candidateImages[imageIndex];
  const hue = [...category.slug].reduce((value, character) => value + character.charCodeAt(0), 0) % 360;

  return (
    <article className="category-card">
      <button
        className="category-card__button"
        type="button"
        onClick={() => onOpen(category.slug)}
        aria-label={`View ${category.title} projects`}
      >
        <span className="category-card__topline">
          <span className="category-card__identity">
            <span>{category.title}</span>
            <span className="category-card__index">/{String(index + 1).padStart(2, "0")}</span>
          </span>
          <span className="category-card__dots" aria-hidden="true">•••</span>
        </span>
        <span className="category-card__image">
          {imageUrl ? (
            <img
              src={imageUrl}
              sizes="(max-width: 700px) 100vw, 33vw"
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImageIndex((current) => current + 1)}
            />
          ) : (
            <span className="category-card__fallback" style={{ "--category-hue": hue }} aria-hidden="true">
              <span className="category-card__fallback-label">{category.title}</span>
              <span className="category-card__fallback-index">{String(index + 1).padStart(2, "0")}</span>
            </span>
          )}
          <span className="category-card__arrow" aria-hidden="true">↗</span>
        </span>
      </button>
    </article>
  );
}
