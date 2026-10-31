import { useState } from "react";
import { getProjectPoster, getYouTubeId } from "./projects";
import InlineYouTubePlayer from "../../Components/InlineYouTubePlayer";
import "./ProjectCard.css";

export default function ProjectCard({ project, category, index, minimal = false }) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const previewPoster = getProjectPoster(project);
  const videoId = getYouTubeId(project.youtubeUrl);

  return (
    <article className={`project-card${minimal ? " project-card--minimal" : ""}`}>
      {!minimal && <header className="project-card__topline">
        <span className="project-card__identity">
          <span>{project.client || category}</span>
          {project.year && <span className="project-card__year">/{project.year}</span>}
        </span>
        <span className="project-card__dots" aria-hidden="true">•••</span>
      </header>}
      <span className="project-card__media">
        {isPlaying && videoId ? (
          <InlineYouTubePlayer
            className="project-card__player"
            videoId={videoId}
            title={project.title || project.client || category}
          />
        ) : (
          <>
            {previewPoster && !posterFailed ? (
              <>
                <img
                  className="project-card__poster"
                  src={previewPoster}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={() => setPosterFailed(true)}
                />
                {!minimal && (project.client || project.title) && (
                  <span className="project-card__wordmark" aria-hidden="true">{project.client || project.title}</span>
                )}
              </>
            ) : (
              <span className="project-card__placeholder" aria-hidden="true">
                {!minimal && <span>ADD POSTER</span>}
              </span>
            )}
            {videoId && (
              <button
                className="project-card__hitarea"
                type="button"
                onClick={() => setIsPlaying(true)}
                aria-label={`Play ${project.title}${minimal ? "" : `, ${category}`}`}
              />
            )}
          </>
        )}
      </span>
      {!minimal && (
        <span className="project-card__caption">
          <span className="project-card__title">{project.title || project.client || "Video project"}</span>
          <span className="project-card__index">{String(index + 1).padStart(2, "0")}</span>
        </span>
      )}
    </article>
  );
}
