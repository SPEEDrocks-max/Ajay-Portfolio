import FeaturedVideoCard from "./FeaturedVideoCard";
import "./FeaturedVideoCard.css";
import "./FeaturedWork.css";

const FEATURED_CONTENT = {
  eyebrow: "A SELECTION OF PROJECTS",
  title: "Work",
  moreLabel: "SHOW MORE WORK",
  video: { url: "https://vimeo.com/1150840402?fl=tl&fe=ec", title: "Delhi to Barog — Solo Bike Ride" },
};

export default function FeaturedWork({ onShowMore, transitionOnly = false, content = FEATURED_CONTENT, style, idPrefix = "featured-work", ...sectionProps }) {
  return (
    <section {...sectionProps} className={`featured-work${transitionOnly ? " featured-work--transition" : ""}`} id={idPrefix === "featured-work" ? "selected-work-section" : `${idPrefix}-section`} aria-labelledby={`${idPrefix}-title`} style={style}>
      <div className="featured-work__inner">
        <header className="featured-work__header">
          <div>
            <p className="featured-work__eyebrow">{content.eyebrow}</p>
            <h2 id={`${idPrefix}-title`}>{content.title}</h2>
          </div>
          <button className="featured-work__more" type="button" onClick={onShowMore}>
            {content.moreLabel} <span aria-hidden="true">↗</span>
          </button>
        </header>
        <div className="featured-work__grid">
          <FeaturedVideoCard video={{ ...content.video, sourceThumbnailFirst: true }} />
        </div>
      </div>
    </section>
  );
}
