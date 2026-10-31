import { useEffect, useState } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import FeaturedVideoCard from "../Landing/FeaturedVideoCard";
import { loadPublishedCategories } from "../../lib/categories";
import { usePageSections } from "../../Components/PageSectionsContext";
import { useGlobalSettings } from "../../Components/GlobalSettingsContext";
import GlobalFooterContent from "../../Components/GlobalFooterContent";
import { getYouTubeId } from "./projects";
import "./CategoryDetail.css";

export default function CategoryDetail({ slug, onBack, isActive = false }) {
  const [categories, setCategories] = useState(null);
  const { sections: configuredSections } = usePageSections();
  const { settings } = useGlobalSettings();
  useEffect(() => {
    let active = true;
    loadPublishedCategories({ includeVideos: true }).then((items) => { if (active) setCategories(items); });
    return () => { active = false; };
  }, [slug]);

  const category = categories?.find((item) => item.slug === slug);
  const playableVideos = category?.videos
    .map((video) => {
      const url = video.url || video.youtubeUrl;
      return { ...video, videoId: video.provider === "youtube" || (!video.provider && video.youtubeUrl) ? getYouTubeId(url) : "", url };
    })
    .filter((video) => Boolean(video.url));
  const sections = configuredSections || [
    { id: "category-header", type: "category-header", enabled: true, order: 0, content: {} },
    { id: "video-grid", type: "video-grid", enabled: true, order: 1, content: {} },
    { id: "category-footer", type: "category-footer", enabled: true, order: 2, content: {} },
  ];

  useEffect(() => {
    if (!isActive) return undefined;
    const lenis = new Lenis({ autoRaf: true, anchors: true, respectReducedMotion: true });
    return () => lenis.destroy();
  }, [isActive]);

  if (!categories) {
    return <main className="work-page category-page"><p className="category-page__empty" role="status">Loading selected work…</p></main>;
  }

  if (!category) {
    return (
      <main className="work-page category-page">
        <header className="category-page__topline">
          <button className="work-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> ALL WORK</button>
          <span className="work-header__credit">{settings.identity.websiteName || "AJAY MEHTA"} <i>/</i> VIDEO EDITOR</span>
        </header>
        <p className="category-page__empty">This category could not be found.</p>
      </main>
    );
  }

  return <main className="work-page category-page">
    {[...sections].filter((section) => section.enabled).sort((a, b) => a.order - b.order).map((section) => {
      const sectionContent = section.content || {};
      if (section.type === "category-header") return <header className="category-page__header" data-design-section="header" key={section.id}>
        <div className="category-page__topline"><button className="work-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> ALL WORK</button><span className="work-header__credit">{settings.identity.websiteName || "AJAY MEHTA"} <i>/</i> VIDEO EDITOR</span></div>
        <div className="category-page__title-wrap"><p className="work-eyebrow">{sectionContent.eyebrow || "SELECTED WORK"} / {category.title}</p><h1 className="category-page__title">{sectionContent.heading || category.title}</h1>{(sectionContent.description || category.description) && <p className="category-page__description">{sectionContent.description || category.description}</p>}</div>
      </header>;
      if (section.type === "video-grid") return <section className="category-page__projects" data-design-section="videos" aria-label={`${category.title} videos`} key={section.id}>
        {playableVideos.length ? <div className="category-page__grid">{playableVideos.map((video, index) => <FeaturedVideoCard key={video.id || `${category.id}-video-${index}`} video={{ id: video.videoId, recordId: video.recordId || video.id, playbackId: video.playbackId, provider: video.provider || (video.youtubeUrl ? "youtube" : undefined), url: video.url, title: video.title || `${category.title} video ${index + 1}`, thumbnail: video.thumbnail, poster: video.poster, client: video.client, year: video.year }} />)}</div> : <p className="category-page__empty">Projects will appear here as they are added.</p>}
      </section>;
      if (section.type === "category-footer") return <footer className="work-footer" data-design-section="footer" key={section.id}><span>{settings.identity.websiteName || sectionContent.name || "AJAY MEHTA"}</span><span>{sectionContent.role || "VIDEO EDITOR & STORYTELLER"}</span><button type="button" onClick={onBack}>{sectionContent.returnLabel || "ALL WORK ↑"}</button><GlobalFooterContent settings={settings} /></footer>;
      return null;
    })}
  </main>;
}
