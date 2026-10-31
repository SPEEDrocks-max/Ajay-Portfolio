import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import CompanyLogoStrip from "../../Components/CompanyLogoStrip";
import FeaturedWork from "./FeaturedWork";
import { DEFAULT_HOME_CONTENT, normalizeHomeContent } from "../../lib/homeContent";
import { usePageSections } from "../../Components/PageSectionsContext";
import { useGlobalSettings } from "../../Components/GlobalSettingsContext";
import { isAssetUrl, isSafeNavigationItem } from "../../lib/globalSettings";
import "./LandingPage.css";

export default function LandingPage({ isActive = false, onShowWork, onShowMoreWork, onShowAbout, onShowContact, homeContent = DEFAULT_HOME_CONTENT }) {
  const pageRef = useRef(null);
  const lenisRef = useRef(null);
  const { sections: sectionStructure } = usePageSections();
  const { settings } = useGlobalSettings();
  const sections = useMemo(() => {
    const contentSections = normalizeHomeContent(homeContent);
    if (!Array.isArray(sectionStructure)) return contentSections;
    return sectionStructure.map((item) => {
      const source = contentSections.find((section) => section.id === item.sourceId);
      if (!source) return null;
      return { ...source, id: item.id, sourceId: item.sourceId, sectionType: item.type, enabled: item.enabled !== false, order: item.order, content: { ...source.content, ...(item.content || {}) } };
    }).filter(Boolean).sort((a, b) => a.order - b.order);
  }, [homeContent, sectionStructure]);
  const visibleSections = sections.filter((section) => section.enabled);
  const heroSection = sections.find((section) => section.sectionType === "home-hero" || section.id === "hero");
  const hero = heroSection?.content;
  const websiteName = settings.identity.websiteName || hero?.railName || "AJAY MEHTA";
  const sectionRow = Object.fromEntries(visibleSections.map((section, index) => [section.id, index + 1]));
  const navigation = Array.isArray(settings.navigation)
    ? [...settings.navigation].filter(isSafeNavigationItem).sort((a, b) => a.order - b.order)
    : hero?.navigation || [];

  const safeHref = (href) => {
    if (["/", "/work", "/about", "/contact", "#experience", "#selected-work"].includes(href)) return href;
    if (/^\/work\/[a-z0-9-]+$/.test(href || "") || /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href || "") || /^https:\/\//i.test(href || "")) return href;
    return "#";
  };

  function handleShowWork(event) {
    event.preventDefault();
    onShowWork?.();
  }

  function handleShowAbout(event) {
    event.preventDefault();
    onShowAbout?.();
  }

  function handleShowContact(event) {
    event.preventDefault();
    onShowContact?.();
  }

  function handleNavigation(event, href) {
    if (href === "#selected-work" || href === "/work") return handleShowWork(event);
    if (href === "/about") return handleShowAbout(event);
    if (href === "/contact") return handleShowContact(event);
  }

  useEffect(() => {
    if (!isActive) return undefined;

    const lenis = new Lenis({ autoRaf: true, anchors: true, respectReducedMotion: true });
    lenisRef.current = lenis;
    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [isActive]);

  useLayoutEffect(() => {
    const page = pageRef.current;
    if (!isActive || !page || !hero) return undefined;

    const portrait = page.querySelector(".profile-portrait");
    const header = page.querySelector(".profile-topbar");
    const eyebrow = page.querySelector(".profile-copy__eyebrow");
    const titleLines = Array.from(page.querySelectorAll(".profile-copy__title-line span"));
    const summary = page.querySelector(".profile-copy__summary");
    const details = Array.from(page.querySelectorAll(".profile-detail"));
    const actions = page.querySelector(".profile-copy__actions");

    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set([header, eyebrow, ...titleLines, summary, ...details, actions], { autoAlpha: 1, clearProps: "transform" });
        gsap.set(portrait, { clipPath: "inset(0 0 0 0)" });
        return;
      }

      const timeline = gsap.timeline();
      timeline.fromTo(portrait, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)", duration: 0.8, ease: "power3.inOut" }, 0);
      timeline.fromTo(header, { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.42, ease: "power2.out" }, 0.08);
      timeline.fromTo(eyebrow, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.38, ease: "power2.out" }, 0.18);
      timeline.fromTo(titleLines, { autoAlpha: 0, yPercent: 105 }, { autoAlpha: 1, yPercent: 0, duration: 0.66, stagger: 0.06, ease: "power3.out" }, 0.2);
      timeline.fromTo([summary, ...details, actions], { autoAlpha: 0, y: 9 }, { autoAlpha: 1, y: 0, duration: 0.38, stagger: 0.06, ease: "power2.out" }, 0.48);
    }, page);

    return () => context.revert();
  }, [hero, isActive]);

  return (
    <div
      ref={pageRef}
      className="profile-page"
      id="top"
      style={{ gridTemplateColumns: heroSection?.enabled ? undefined : "minmax(0, 1fr)", gridTemplateRows: `repeat(${Math.max(visibleSections.length, 1)}, auto)` }}
    >
      {hero && heroSection?.enabled && (
        <aside className="profile-rail" aria-label={`${hero.railName} portfolio`} style={{ gridRow: sectionRow[heroSection.id] }}>
          <span className="profile-rail__mark" aria-hidden="true">{hero.initials}</span>
          <span className="profile-rail__accent" aria-hidden="true" />
          <span className="profile-rail__name" aria-hidden="true">{websiteName}</span>
          <span className="profile-rail__foot">{hero.pageLabel}</span>
        </aside>
      )}

      {visibleSections.map((section, index) => {
        const sectionType = section.sectionType || section.id;
        if (sectionType === "home-hero" || sectionType === "hero") {
          return (
            <main className="profile-main" data-design-section="hero" key={section.id} style={{ gridColumn: heroSection?.enabled ? 2 : 1, gridRow: index + 1 }}>
              <header className="profile-topbar">
                <a className="profile-topbar__identity" href="#top" aria-label={websiteName}>{isAssetUrl(settings.identity.logoUrl) ? <img className="profile-topbar__logo" src={settings.identity.logoUrl} alt={websiteName} /> : <span className="profile-topbar__role">{hero.headerRole}</span>}</a>
                <nav className="profile-nav" aria-label="Main navigation">
                  {navigation.map((item, navIndex) => <a key={item.id || item._key || `${item.label}-${navIndex}`} href={safeHref(item.href)} target={item.external ? "_blank" : undefined} rel={item.external ? "noopener noreferrer" : undefined} onClick={(event) => handleNavigation(event, item.href)}>{item.label}</a>)}
                </nav>
              </header>

              <section className="profile-feature">
                <figure className="profile-figure" id="work">
                  <div className="profile-portrait">
                    <img src={hero.profileImageUrl} alt={hero.railName} />
                    <div className="profile-stat-card"><strong>{hero.statValue}</strong><span>{hero.statCaption}</span></div>
                  </div>
                </figure>

                <section className="profile-copy" id="about" aria-labelledby="profile-title">
                  <p className="profile-copy__eyebrow">{hero.eyebrow}</p>
                  <h1 className="profile-copy__title" id="profile-title">
                    <span className="profile-copy__title-line"><span>{hero.title}</span></span>
                    <span className="profile-copy__title-line profile-copy__title-line--accent"><span>{hero.accentTitle}</span></span>
                  </h1>
                  <p className="profile-copy__summary"><span className="profile-copy__summary-accent">{hero.descriptionHighlight}</span>{hero.descriptionHighlight && hero.descriptionContinuation ? " " : ""}{hero.descriptionContinuation}</p>

                  <div className="profile-details" id="experience">
                    {(hero.details || []).map(({ label, value }, detailIndex) => (
                      <div className="profile-detail" key={`${label}-${detailIndex}`}>
                        <div><p>{label}</p><span>{label}</span></div>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="profile-copy__actions" id="contact">
                    <a className="profile-button profile-button--solid" href={safeHref(settings.contact.ctaHref || hero.buttonHref)} onClick={(event) => handleNavigation(event, settings.contact.ctaHref || hero.buttonHref)}>{hero.buttonLabel}</a>
                    <a className="profile-button profile-button--outline" href={safeHref(hero.secondaryButtonHref)} onClick={(event) => handleNavigation(event, hero.secondaryButtonHref)}>{hero.secondaryButtonLabel}</a>
                  </div>
                </section>
              </section>
            </main>
          );
        }

        if (sectionType === "client-logos" || sectionType === "company-logos") {
          return <CompanyLogoStrip key={section.id} content={section.content} style={{ gridRow: index + 1 }} data-design-section="company-logos" />;
        }

        if (sectionType === "featured-work") {
          return <FeaturedWork key={section.id} idPrefix={section.id} content={section.content} onShowMore={onShowMoreWork ?? onShowWork} style={{ gridRow: index + 1 }} data-design-section="featured-work" />;
        }

        return null;
      })}
    </div>
  );
}
