import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Intro from "./Pages/Intro/Intro";
import LandingPage from "./Pages/Landing/LandingPage";
import FeaturedWork from "./Pages/Landing/FeaturedWork";
import ScreenTransition from "./Components/ScreenTransition";
import CustomCursor from "./Components/CustomCursor/CustomCursor";
import { DEFAULT_HOME_CONTENT, loadPublishedHomeContent } from "./lib/homeContent";
import PageDesignScope from "./Components/PageDesignScope";
import PageSectionsScope from "./Components/PageSectionsScope";
import { GlobalSettingsProvider, useGlobalSettings } from "./Components/GlobalSettingsContext";
import { isAssetUrl, isHttpsUrl, loadPublishedPageSeo } from "./lib/globalSettings";

const Work = lazy(() => import("./Pages/Work/Work"));
const CategoryDetail = lazy(() => import("./Pages/Work/CategoryDetail"));
const AboutPage = lazy(() => import("./Pages/About/AboutPage"));
const ContactPage = lazy(() => import("./Pages/Contact/ContactPage"));

function normalizePath(pathname) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return normalizedPath === "/work" || normalizedPath === "/about" || normalizedPath === "/contact" || /^\/work\/[a-z0-9-]+$/.test(normalizedPath)
    ? normalizedPath
    : "/";
}

function PortfolioApp() {
  const { settings } = useGlobalSettings();
  const initialPath = normalizePath(window.location.pathname);
  const searchParams = new URLSearchParams(window.location.search);
  const studioPreview = searchParams.has("studioPreview") || searchParams.has("studioSectionsPreview") || searchParams.has("globalSettingsPreview");
  const [introComplete, setIntroComplete] = useState(studioPreview);
  const [introTransitionComplete, setIntroTransitionComplete] = useState(studioPreview);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [routeTransition, setRouteTransition] = useState(null);
  const [transitionKey, setTransitionKey] = useState(0);
  const [homeContent, setHomeContent] = useState(DEFAULT_HOME_CONTENT);
  const pageSeoSlug = currentPath === "/" ? "home" : currentPath === "/work" ? "work" : currentPath === "/about" ? "about" : currentPath === "/contact" ? "contact" : "";
  const [pageSeoState, setPageSeoState] = useState({ slug: "", data: null });
  const pageSeo = pageSeoState.slug === pageSeoSlug ? pageSeoState.data : null;
  const routeRef = useRef(initialPath);
  const transitionRef = useRef(null);
  const pendingPathRef = useRef(null);
  const transitionSequenceRef = useRef(0);

  useEffect(() => {
    const isHomeRoute = currentPath === "/" || routeTransition?.from === "/" || routeTransition?.to === "/";
    if (!isHomeRoute) return undefined;
    let active = true;
    loadPublishedHomeContent().then((content) => {
      if (active) setHomeContent(content);
    });
    return () => { active = false; };
  }, [currentPath, routeTransition?.from, routeTransition?.to]);

  useEffect(() => {
    if (!pageSeoSlug) return undefined;
    let active = true;
    loadPublishedPageSeo(pageSeoSlug).then((value) => { if (active) setPageSeoState({ slug: pageSeoSlug, data: value }); });
    return () => { active = false; };
  }, [pageSeoSlug]);

  useEffect(() => {
    const pageLabel = currentPath === "/about" ? "About" : currentPath === "/work" || currentPath.startsWith("/work/") ? "Selected Work" : currentPath === "/contact" ? "Contact" : "Video Editor & Storyteller";
    const websiteName = settings.identity.websiteName || "Ajay Mehta";
    const title = pageSeo?.seo_title?.trim() || settings.seo.title || settings.identity.websiteTitle || `${pageLabel} — ${websiteName}`;
    const description = pageSeo?.seo_description?.trim() || settings.seo.description || settings.identity.description || "Ajay Mehta — Video Editor & Storyteller";
    document.title = title;
    const ensureMeta = (selector, kind, key, value) => {
      let nodes = Array.from(document.head.querySelectorAll(selector));
      let meta = nodes.shift();
      nodes.forEach((duplicate) => duplicate.remove());
      if (!value) { meta?.remove(); return; }
      if (!meta) { meta = document.createElement("meta"); meta.setAttribute(kind, key); document.head.append(meta); }
      meta.content = value;
    };
    const ogTitle = pageSeo?.seo_title?.trim() || settings.seo.ogTitle || title;
    const ogDescription = pageSeo?.seo_description?.trim() || settings.seo.ogDescription || description;
    const configuredShareImage = settings.seo.ogImageUrl || settings.identity.defaultShareImageUrl;
    const shareImage = isAssetUrl(configuredShareImage) ? configuredShareImage : "";
    const configuredTwitterImage = settings.seo.twitterImageUrl || shareImage;
    const twitterImage = isAssetUrl(configuredTwitterImage) ? configuredTwitterImage : "";
    ensureMeta('meta[name="description"]', "name", "description", description);
    ensureMeta('meta[name="keywords"]', "name", "keywords", settings.seo.keywords);
    ensureMeta('meta[property="og:title"]', "property", "og:title", ogTitle);
    ensureMeta('meta[property="og:description"]', "property", "og:description", ogDescription);
    ensureMeta('meta[property="og:image"]', "property", "og:image", shareImage);
    ensureMeta('meta[name="twitter:card"]', "name", "twitter:card", twitterImage ? "summary_large_image" : "summary");
    ensureMeta('meta[name="twitter:title"]', "name", "twitter:title", ogTitle);
    ensureMeta('meta[name="twitter:description"]', "name", "twitter:description", ogDescription);
    ensureMeta('meta[name="twitter:image"]', "name", "twitter:image", twitterImage);

    const iconUrl = isAssetUrl(settings.identity.faviconUrl) ? settings.identity.faviconUrl : "/favicon.svg";
    let icon = document.head.querySelector('link[rel~="icon"]');
    if (!icon) { icon = document.createElement("link"); icon.rel = "icon"; document.head.append(icon); }
    icon.href = iconUrl;
    const extension = iconUrl.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
    icon.type = extension === "svg" ? "image/svg+xml" : extension === "png" ? "image/png" : extension === "ico" ? "image/x-icon" : "";

    let canonical = document.head.querySelector('link[rel="canonical"][data-global-settings]');
    if (settings.seo.canonicalDomain && isHttpsUrl(settings.seo.canonicalDomain)) {
      if (!canonical) { canonical = document.createElement("link"); canonical.rel = "canonical"; canonical.dataset.globalSettings = "true"; document.head.append(canonical); }
      canonical.href = `${new URL(settings.seo.canonicalDomain).origin}${currentPath}`;
    } else canonical?.remove();
  }, [currentPath, pageSeo, settings]);

  const navigate = useCallback((destination, { push = true, outgoingSection = null } = {}) => {
    const nextPath = normalizePath(destination);
    if (transitionRef.current) {
      if (!push) pendingPathRef.current = nextPath;
      return;
    }

    const previousPath = routeRef.current;
    if (nextPath === previousPath) return;

    if (push) window.history.pushState({}, "", nextPath);
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });

    const id = ++transitionSequenceRef.current;
    const nextTransition = { from: previousPath, to: nextPath, id, outgoingSection };
    routeRef.current = nextPath;
    transitionRef.current = nextTransition;
    setCurrentPath(nextPath);
    setTransitionKey(id);
    setRouteTransition(nextTransition);
  }, []);

  const finishRouteTransition = useCallback(() => {
    if (!transitionRef.current) return;
    transitionRef.current = null;
    setRouteTransition(null);

    const pendingPath = pendingPathRef.current;
    pendingPathRef.current = null;
    if (pendingPath && pendingPath !== routeRef.current) {
      window.setTimeout(() => navigate(pendingPath, { push: false }), 0);
    }
  }, [navigate]);

  useEffect(() => {
    function handlePopState() {
      navigate(window.location.pathname, { push: false });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigate]);

  function renderPageContent(path, isActive, workSectionOnly = false) {
    if (path === "/contact") {
      return (
        <Suspense fallback={<div className="work-loading" role="status">Loading contact…</div>}>
          <ContactPage isActive={isActive} onBack={() => navigate("/")} />
        </Suspense>
      );
    }
    if (path === "/about") {
      return (
        <Suspense fallback={<div className="about-loading" role="status">Loading about…</div>}>
          <AboutPage isActive={isActive} onBack={() => navigate("/")} />
        </Suspense>
      );
    }

    if (path === "/work") {
      return (
        <Suspense fallback={<div className="work-loading" role="status">Loading work…</div>}>
          <Work
            key={path}
            isActive={isActive}
            onBack={() => navigate("/")}
            onOpenCategory={(slug) => navigate(`/work/${slug}`)}
          />
        </Suspense>
      );
    }

    if (path.startsWith("/work/")) {
      return (
        <Suspense fallback={<div className="work-loading" role="status">Loading category…</div>}>
          <CategoryDetail
            key={path}
            slug={path.slice("/work/".length)}
            isActive={isActive}
            onBack={() => navigate("/work")}
          />
        </Suspense>
      );
    }

    if (workSectionOnly) {
      const featuredWork = homeContent.find((section) => section.id === "featured-work");
      return <FeaturedWork transitionOnly content={featuredWork?.content} />;
    }

    return (
      <LandingPage
        key={path}
        homeContent={homeContent}
        isActive={isActive}
        onShowWork={() => navigate("/work")}
        onShowMoreWork={() => navigate("/work", { outgoingSection: "work" })}
        onShowAbout={() => navigate("/about")}
        onShowContact={() => navigate("/contact")}
        onOpenCategory={(slug) => navigate(`/work/${slug}`)}
      />
    );
  }

  function renderPage(path, isActive, workSectionOnly = false) {
    return <PageDesignScope key={path} path={path}><PageSectionsScope path={path}>{renderPageContent(path, isActive, workSectionOnly)}</PageSectionsScope></PageDesignScope>;
  }

  const incomingPath = routeTransition?.to ?? currentPath;
  const incoming = renderPage(incomingPath, introComplete && !routeTransition);
  const isLandingToWork = routeTransition?.from === "/"
    && routeTransition.to === "/work"
    && routeTransition.outgoingSection === "work";
    const outgoing = routeTransition
    ? renderPage(routeTransition.from, false, isLandingToWork)
      : introTransitionComplete ? null : <Intro onComplete={() => setIntroComplete(true)} />;
  const selectionSelector = !routeTransition
    ? ".intro-full-name"
    : routeTransition.from === "/work"
      ? ".work-heading h1"
      : routeTransition.from.startsWith("/work/")
        ? ".category-page__title"
        : routeTransition.from === "/about"
          ? ".about-page__title"
        : isLandingToWork
          ? ".featured-work__header h2"
          : routeTransition.from === "/contact"
            ? ".contact-page__title"
          : ".profile-copy__title";

  if (studioPreview) {
    return <div className="studio-public-preview">{renderPage(currentPath, true)}</div>;
  }

  return (
    <>
      <ScreenTransition
        key={transitionKey}
        active={introComplete || Boolean(routeTransition)}
        incoming={incoming}
        outgoing={outgoing}
        selectionSelector={selectionSelector}
        onComplete={routeTransition ? finishRouteTransition : introComplete ? () => setIntroTransitionComplete(true) : undefined}
      />
      <CustomCursor />
    </>
  );
}

export default function App() {
  return <GlobalSettingsProvider><PortfolioApp /></GlobalSettingsProvider>;
}
