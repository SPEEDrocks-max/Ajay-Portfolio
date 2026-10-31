import { useState } from "react";
import "./CategoryCard.css";

export default function CategoryCard({ category, index, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false);

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
          {category.thumbnail && !imageFailed ? (
            <img
              src={category.thumbnail}
              sizes="(max-width: 700px) 100vw, 33vw"
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span className="category-card__fallback" aria-hidden="true" />
          )}
          <span className="category-card__arrow" aria-hidden="true">↗</span>
        </span>
      </button>
    </article>
  );
}
