import { useEffect, useState } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import CategoryCard from "./CategoryCard";
import { loadPublishedCategories } from "../../lib/categories";
import { usePageSections } from "../../Components/PageSectionsContext";
import { useGlobalSettings } from "../../Components/GlobalSettingsContext";
import GlobalFooterContent from "../../Components/GlobalFooterContent";
import "./Work.css";

export default function Work({ onBack, onOpenCategory, isActive = false }) {
  const [categories, setCategories] = useState([]);
  const { sections: configuredSections } = usePageSections();
  const { settings } = useGlobalSettings();

  useEffect(() => {
    let active = true;
    loadPublishedCategories({ includeVideos: true }).then((items) => { if (active) setCategories(items); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isActive) return undefined;

    const lenis = new Lenis({ autoRaf: true, anchors: true, respectReducedMotion: true });
    return () => {
      lenis.destroy();
    };
  }, [isActive]);

  const sections = configuredSections || [
    { id: "work-header", type: "work-header", enabled: true, order: 0, content: {} },
    { id: "category-grid", type: "category-grid", enabled: true, order: 1, content: {} },
    { id: "work-footer", type: "work-footer", enabled: true, order: 2, content: {} },
  ];
  const templateByType = Object.fromEntries(sections.map((section) => [section.type, section]));
  const fallback = (type) => templateByType[type] || { content: {} };
  const heading = fallback("work-header").content?.heading || "Moving images,\nshaped with intent.";
  const intro = fallback("work-header").content?.intro || "Editorial storytelling across formats. Explore selected work by discipline.";
  const footer = fallback("work-footer").content || {};

  return (
    <main className="work-page">
      {[...sections].filter((section) => section.enabled).sort((a, b) => a.order - b.order).map((section) => {
        if (section.type === "work-header") return <header className="work-header" data-design-section="header" key={section.id}>
          <div className="work-header__topline"><button className="work-back" type="button" onClick={onBack}><span aria-hidden="true">←</span> BACK TO HOME</button><span className="work-header__credit">{settings.identity.websiteName || "AJAY MEHTA"} <i>/</i> VIDEO EDITOR</span></div>
          <div className="work-heading"><div><p className="work-eyebrow">SELECTED WORK</p><h1 style={{ whiteSpace: "pre-line" }}>{heading}</h1></div><p className="work-intro">{intro}</p></div>
        </header>;
        if (section.type === "category-grid") return <section className="work-category-grid" data-design-section="categories" aria-label="Work categories" key={section.id}>
          {categories.length ? categories.map((category, index) => <CategoryCard key={category.id} category={category} index={index} onOpen={onOpenCategory} />) : <p className="category-page__empty">Work categories will appear here when they are published.</p>}
        </section>;
        if (section.type === "work-footer") return <footer className="work-footer" data-design-section="footer" key={section.id}><span>{settings.identity.websiteName || footer.name || "AJAY MEHTA"}</span><span>{footer.role || "VIDEO EDITOR & STORYTELLER"}</span><button type="button" onClick={onBack}>{footer.returnLabel || "RETURN HOME ↑"}</button><GlobalFooterContent settings={settings} /></footer>;
        return null;
      })}
    </main>
  );
}
