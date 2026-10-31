import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { DEFAULT_ABOUT_CONTENT, loadPublishedAboutContent, normalizeAboutContent } from "../../lib/aboutContent";
import { usePageSections } from "../../Components/PageSectionsContext";
import { useGlobalSettings } from "../../Components/GlobalSettingsContext";
import GlobalFooterContent from "../../Components/GlobalFooterContent";
import ProjectCard from "../Work/ProjectCard";
import "./AboutPage.css";

gsap.registerPlugin(ScrollTrigger);

function bySortOrder(items) {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export default function AboutPage({ isActive = false, onBack, content: previewContent }) {
  const rootRef = useRef(null);
  const [portraitFailedUrl, setPortraitFailedUrl] = useState("");
  const [publishedContent, setPublishedContent] = useState(DEFAULT_ABOUT_CONTENT);
  const { sections: configuredSections } = usePageSections();
  const { settings } = useGlobalSettings();
  const defaultSectionStructure = useMemo(() => [
    { id: "about-experience", type: "about-experience", enabled: true, order: 0, content: {} },
    { id: "about-tools", type: "about-tools", enabled: true, order: 1, content: {} },
    { id: "about-footer", type: "about-footer", enabled: true, order: 2, content: {} },
  ], []);
  const sectionStructure = configuredSections || defaultSectionStructure;
  const experienceConfig = sectionStructure.find((section) => section.type === "about-experience");
  const toolsConfig = sectionStructure.find((section) => section.type === "about-tools");
  const footerConfig = sectionStructure.find((section) => section.type === "about-footer");
  const aboutLayerOrder = useMemo(() => [...sectionStructure].filter((section) => section.enabled && ["about-experience", "about-tools"].includes(section.type)).sort((a, b) => a.order - b.order).map((section) => section.type), [sectionStructure]);
  const pageContent = useMemo(() => {
    const base = normalizeAboutContent(previewContent || publishedContent);
    return {
      ...base,
      ...(experienceConfig?.content?.experienceTitle !== undefined ? { experienceTitle: experienceConfig.content.experienceTitle } : {}),
      ...(experienceConfig?.content?.experienceIntro !== undefined ? { experienceIntro: experienceConfig.content.experienceIntro } : {}),
      ...(toolsConfig?.content || {}),
      ...(footerConfig?.content?.name !== undefined ? { footerName: footerConfig.content.name } : {}),
      ...(footerConfig?.content?.role !== undefined ? { footerRole: footerConfig.content.role } : {}),
      ...(footerConfig?.content?.returnLabel !== undefined ? { footerReturnLabel: footerConfig.content.returnLabel } : {}),
    };
  }, [previewContent, publishedContent, experienceConfig, toolsConfig, footerConfig]);
  const portraitAvailable = Boolean(pageContent.portraitUrl) && portraitFailedUrl !== pageContent.portraitUrl;
  const experiences = bySortOrder(pageContent.experiences.filter((item) => item.company || item.role || item.description));
  const tools = bySortOrder(pageContent.tools.filter((item) => item.name));
  const toolsWithLogos = tools.filter((item) => typeof item.logo === "string" && item.logo.trim());
  const specializations = bySortOrder(pageContent.specializations.filter((item) => item.title));

  useEffect(() => {
    if (previewContent) return undefined;
    let active = true;
    loadPublishedAboutContent().then((loaded) => { if (active) setPublishedContent(loaded); });
    return () => { active = false; };
  }, [previewContent]);

  useLayoutEffect(() => {
    if (!isActive) return undefined;

    const lenis = new Lenis({ autoRaf: true, anchors: true, respectReducedMotion: true });
    const updateScrollTrigger = () => ScrollTrigger.update();
    lenis.on("scroll", updateScrollTrigger);
    return () => {
      lenis.destroy();
    };
  }, [isActive]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !isActive) return undefined;

    const viewport = root.querySelector(".about-story__viewport");
    const experienceLayer = root.querySelector(".about-layer--experience");
    const toolsLayer = root.querySelector(".about-layer--tools");
    const cloud = root.querySelector(".about-tools-cloud");
    if (!viewport || !experienceLayer || !toolsLayer || !cloud || !aboutLayerOrder.length) return undefined;

    let media;
    let refreshFrame = 0;
    let cancelled = false;
    const context = gsap.context(() => {
      media = gsap.matchMedia();
      media.add("(min-width: 901px) and (prefers-reduced-motion: no-preference)", () => {
        const layerElements = { "about-experience": experienceLayer, "about-tools": toolsLayer };
        gsap.set(experienceLayer, { autoAlpha: aboutLayerOrder[0] === "about-experience" ? 1 : 0 });
        gsap.set(toolsLayer, { autoAlpha: aboutLayerOrder[0] === "about-tools" ? 1 : 0 });
        gsap.set(cloud, { scale: 0.9, transformOrigin: "50% 50%" });

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            pin: viewport,
            start: "top top",
            end: () => {
              const totalPanels = Math.max(2.5, aboutLayerOrder.length * 1.1);
              return `+=${Math.round(window.innerHeight * totalPanels)}`;
            },
            scrub: 0.65,
            anticipatePin: 1,
            invalidateOnRefresh: true,
          },
        });

        aboutLayerOrder.forEach((layerType, index) => {
          if (layerType === "about-tools") {
            timeline.to(cloud, { scale: 1, duration: 0.9, ease: "none" });
          }
          const nextLayerType = aboutLayerOrder[index + 1];
          if (nextLayerType) {
            timeline.to(layerElements[layerType], { autoAlpha: 0, duration: 0.85, ease: "none" });
            timeline.to(layerElements[nextLayerType], { autoAlpha: 1, duration: 0.85, ease: "none" }, "<");
            timeline.to({}, { duration: 0.25 });
          }
        });

        refreshFrame = window.requestAnimationFrame(() => {
          if (!cancelled) ScrollTrigger.refresh();
        });
        document.fonts?.ready.then(() => {
          if (!cancelled) ScrollTrigger.refresh();
        });
        return () => {
          window.cancelAnimationFrame(refreshFrame);
          timeline.scrollTrigger?.kill();
        };
      });
    }, root);

    return () => {
      cancelled = true;
      media?.revert();
      context.revert();
    };
  }, [isActive, experiences.length, tools.length, pageContent, aboutLayerOrder]);

  return (
    <main ref={rootRef} className="about-page" id="about-top">
      <section className="about-story" aria-label={`About ${pageContent.topbarName}`}>
        <div className="about-story__viewport">
          <div className="about-story__topbar">
            <a href="/" onClick={(event) => { event.preventDefault(); onBack?.(); }}>
              {settings.identity.websiteName || pageContent.topbarName} <span>/</span> ABOUT
            </a>
            <span>{pageContent.topbarRole}</span>
            <span className="about-story__index">01 — 02</span>
          </div>

          <section className="about-layer about-layer--experience" data-design-section="experience" aria-labelledby="about-experience-title" style={{ display: !experienceConfig || experienceConfig.enabled === false ? "none" : undefined, zIndex: aboutLayerOrder[0] === "about-experience" ? 3 : 2 }}>
            <div className="about-experience-copy">
              <p className="about-eyebrow"><span>01</span> / {pageContent.experienceEyebrow}</p>
              <h1 className="about-page__title" id="about-experience-title">{pageContent.experienceTitle}</h1>
              <p className="about-experience-intro">{pageContent.experienceIntro}</p>

              <div className="about-experience-list">
                {experiences.length ? experiences.map((item, index) => (
                  <article className="about-experience-entry" key={item.id || item.company}>
                    <span className="about-experience-entry__marker">{String(index + 1).padStart(2, "0")}</span>
                    <div className={`about-experience-entry__body${item.logo ? " has-logo" : ""}`}>
                      <div className="about-experience-entry__heading">
                        <h2>{item.company}</h2>
                      </div>
                      {item.role && <p className="about-experience-entry__role">{item.role}</p>}
                      {item.description && <p className="about-experience-entry__description">{item.description}</p>}
                      {item.logo && <img className="about-experience-entry__logo" src={item.logo} alt={`${item.company} logo`} loading="lazy" />}
                    </div>
                  </article>
                )) : (
                  <div className="about-empty about-empty--experience">
                    <span className="about-experience-entry__marker">01</span>
                    <p>{pageContent.experienceEmptyText || "Professional experience details are being added."}</p>
                  </div>
                )}
              </div>
            </div>

            <figure className={`about-portrait${portraitAvailable ? " about-portrait--pending" : " about-portrait--empty"}`}>
              {portraitAvailable && (
                <img
                  src={pageContent.portraitUrl}
                  alt={pageContent.portraitAlt}
                  onError={() => setPortraitFailedUrl(pageContent.portraitUrl)}
                  onLoad={() => ScrollTrigger.refresh()}
                />
              )}
              {!portraitAvailable && (
                <div className="about-portrait__empty">
                  <span>{pageContent.portraitEmptyKicker}</span>
                  <strong>{pageContent.portraitInitials}</strong>
                  <small>{pageContent.portraitEmptyCaption}</small>
                </div>
              )}
              <figcaption><span>FIG. 01</span><span>{pageContent.portraitCaption}</span></figcaption>
            </figure>
            <span className="about-layer__folio">{pageContent.experienceFolio}</span>
          </section>

          <section className="about-layer about-layer--tools" data-design-section="tools" aria-labelledby="about-tools-title" style={{ display: !toolsConfig || toolsConfig.enabled === false ? "none" : undefined, zIndex: aboutLayerOrder[0] === "about-tools" ? 3 : 2 }}>
            <div className="about-tools-left">
              <div className="about-tools-cloud-wrap">
                <div className="about-tools-cloud" aria-label="Uploaded software logos">
                  <div className="about-tools-cloud__items">
                    {toolsWithLogos.map((tool, index) => {
                      const angle = (index / Math.max(toolsWithLogos.length, 1)) * Math.PI * 2 - Math.PI / 2;
                      const radius = toolsWithLogos.length < 4 ? 25 : 30;
                      const radiusVariation = [0, 3, -2, 2, -3][index % 5];
                      const x = Math.cos(angle) * (radius + radiusVariation);
                      const y = Math.sin(angle) * (radius + radiusVariation);
                      return (
                        <span className="about-tool" key={tool.id || tool.name} style={{ "--tool-x": `${x}%`, "--tool-y": `${y}%`, "--tool-tilt": `${[-7, 4, -3, 6, -5][index % 5]}deg`, "--tool-layer": index }}>
                          <img src={tool.logo} alt={tool.name} loading="lazy" decoding="async" />
                        </span>
                      );
                    })}
                    {!toolsWithLogos.length && <p className="about-tools-empty">Add tool logos to build this orbit.</p>}
                  </div>
                </div>
              </div>

              <div className="about-tools-heading">
              <h2 id="about-tools-title">{pageContent.toolsTitle} <em>{pageContent.toolsAccent}</em></h2>
              </div>
            </div>

            <aside className="about-specializations" aria-labelledby="about-specializations-title">
              <p className="about-specializations__eyebrow">FROM FIRST CUT TO FINAL FRAME</p>
              <h3 id="about-specializations-title">{pageContent.specializationsTitle}</h3>
              <p className="about-specializations__intro">I shape raw footage into clear, expressive stories—balancing pace, sound and visual detail from the first cut to the final frame.</p>
              <div className="about-specializations__tags" aria-label="Creative focus areas"><span>STORY-LED EDITS</span><span>MOTION &amp; PACING</span><span>FINISHING DETAILS</span></div>
              {specializations.length ? (
                <ol>
                  {specializations.map((item, index) => (
                    <li key={item.id || item.title}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div><strong>{item.title}</strong>{item.description && <p>{item.description}</p>}</div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="about-empty about-empty--specializations">{pageContent.specializationsEmptyText}</p>
              )}
            </aside>
            <span className="about-layer__folio">{pageContent.toolsFolio}</span>
          </section>
        </div>
      </section>

      <section className="about-youtube" aria-labelledby="about-youtube-title">
        <header className="about-youtube__heading">
          <div>
            <p className="about-youtube__eyebrow">03 / OFF THE TIMELINE</p>
            <h2 id="about-youtube-title">More stories,<br /><em>on YouTube.</em></h2>
          </div>
          <p>Films, experiments and a little more of the process behind the work.</p>
        </header>
        <a className="about-youtube__banner" href="https://www.youtube.com/@ajjumehtafilms" target="_blank" rel="noopener noreferrer" aria-label="Open Ajay Mehta's YouTube channel in a new tab">
          {pageContent.youtubeBannerUrl ? <img className="about-youtube__banner-image" src={pageContent.youtubeBannerUrl} alt="" loading="lazy" decoding="async" /> : <div className="about-youtube__banner-placeholder" aria-hidden="true"><span>CHANNEL PHOTO</span></div>}
          <span><small>AJAY MEHTA / YOUTUBE CHANNEL</small><strong>More stories. More process.</strong></span>
          <b>VISIT THE CHANNEL <i aria-hidden="true">↗</i></b>
        </a>
        <div className="about-youtube__grid">
          <ProjectCard project={{ title: "YouTube Film 01", client: "SELECTED VIDEO", youtubeUrl: "https://youtu.be/43oiVmG6XzE" }} category="YOUTUBE" index={0} minimal />
          <ProjectCard project={{ title: "YouTube Film 02", client: "SELECTED VIDEO", youtubeUrl: "https://youtu.be/W7cEnCL3B1Q" }} category="YOUTUBE" index={1} minimal />
        </div>
      </section>

      {footerConfig?.enabled && <footer className="about-footer">
        <span>{settings.identity.websiteName || pageContent.footerName}</span>
        <span>{pageContent.footerRole}</span>
        <button type="button" onClick={onBack}>{pageContent.footerReturnLabel}</button>
        <GlobalFooterContent settings={settings} />
      </footer>}
    </main>
  );
}
