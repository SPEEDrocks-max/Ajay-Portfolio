import { useEffect, useMemo, useState } from "react";
import { designToCssVariables, fontFaceCss, getDesignTarget, loadPublishedPageDesign, mergePageDesign, normalizePageDesign } from "../lib/pageDesign";

function readPreview(target) {
  if (!target) return null;
  try {
    const value = sessionStorage.getItem(`portfolio-studio-preview:${target}`);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function readPublishedCache(target) {
  try {
    const entry = JSON.parse(sessionStorage.getItem(`portfolio-page-design:${target}`) || "null");
    return entry && Date.now() - entry.time < 300000 ? entry.design : null;
  } catch { return null; }
}

function safeCss(value) {
  if (typeof value !== "string") return "";
  return /^[#(),.%\w\s-]+$/.test(value) ? value : "";
}

function sectionCss(design, target) {
  const scope = `.page-design-scope[data-page-design="${target}"]`;
  return Object.entries(design.sections || {}).map(([id, section]) => {
    if (!/^[a-z-]+$/.test(id)) return "";
    const background = safeCss(section.background);
    const text = safeCss(section.text);
    const image = typeof section.imageUrl === "string" && /^https:\/\//i.test(section.imageUrl) ? section.imageUrl.replace(/["\\\n\r]/g, "") : "";
    const imageSize = ["cover", "contain", "auto"].includes(section.imageSize) ? section.imageSize : "";
    const padding = Number(section.padding);
    const minHeight = Number(section.minHeight);
    const alignment = ["left", "center", "right"].includes(section.alignment) ? section.alignment : "";
    const declarations = [
      background ? `background:${background}!important` : "",
      image ? `background-image:url("${image}")!important` : "",
      imageSize ? `background-size:${imageSize}!important` : "",
      text ? `color:${text}!important` : "",
      Number.isFinite(padding) && padding >= 0 && padding <= 400 ? `padding-block:${padding}px!important` : "",
      Number.isFinite(minHeight) && minHeight >= 0 && minHeight <= 1600 ? `min-height:${minHeight}px!important` : "",
      alignment ? `text-align:${alignment}!important` : "",
    ].filter(Boolean).join(";");
    return declarations ? `${scope} [data-design-section="${id}"]{${declarations}}` : "";
  }).join("\n");
}

export default function PageDesignScope({ path, children }) {
  const target = getDesignTarget(path);
  const isCategory = target.startsWith("category:");
  const [published, setPublished] = useState({});
  const [categoryDefault, setCategoryDefault] = useState(() => isCategory ? readPublishedCache("category-detail") || {} : {});
  const queryTarget = new URLSearchParams(window.location.search).get("studioPreview");
  const previewTarget = queryTarget === target || (isCategory && queryTarget === "category-detail") ? queryTarget : "";
  const [previewDesign, setPreviewDesign] = useState(() => previewTarget ? readPreview(previewTarget) : null);
  const [designReady, setDesignReady] = useState(() => Boolean((previewTarget && readPreview(previewTarget)) || readPublishedCache(target)));
  const [cachedCategoryDefault] = useState(() => isCategory ? readPublishedCache("category-detail") : null);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadPublishedPageDesign(target),
      isCategory ? loadPublishedPageDesign("category-detail") : Promise.resolve({}),
    ]).then(([specific, defaultDesign]) => {
      if (!active) return;
      setPublished(specific); setCategoryDefault(defaultDesign);
      try {
        sessionStorage.setItem(`portfolio-page-design:${target}`, JSON.stringify({ time: Date.now(), design: specific }));
        if (isCategory) sessionStorage.setItem("portfolio-page-design:category-detail", JSON.stringify({ time: Date.now(), design: defaultDesign }));
      } catch { /* Public rendering still falls back to original styling. */ }
      setDesignReady(true);
    });
    return () => { active = false; };
  }, [target, path, isCategory, previewTarget]);

  useEffect(() => {
    function updatePreview(event) {
      if (event.key && event.key !== `portfolio-studio-preview:${previewTarget}`) return;
      setPreviewDesign(previewTarget ? readPreview(previewTarget) : null);
    }
    window.addEventListener("storage", updatePreview);
    window.addEventListener("portfolio-design-preview", updatePreview);
    return () => {
      window.removeEventListener("storage", updatePreview);
      window.removeEventListener("portfolio-design-preview", updatePreview);
    };
  }, [target, path, previewTarget]);

  const preview = previewDesign !== null;
  const design = useMemo(() => normalizePageDesign(preview
    ? previewDesign
    : isCategory ? mergePageDesign(categoryDefault || cachedCategoryDefault, published || readPublishedCache(target) || {}) : published || readPublishedCache(target) || {}), [preview, previewDesign, isCategory, categoryDefault, cachedCategoryDefault, published, target]);
  const variables = useMemo(() => designToCssVariables(design, target), [design, target]);
  const fonts = fontFaceCss(design, target);
  const scope = `.page-design-scope[data-page-design="${target}"]`;
  const scopedCss = `${fonts}\n${scope}{color:var(--site-text,inherit);font-family:var(--site-font-body,"DM Sans"),Arial,sans-serif;font-size:var(--design-body-size,inherit)}\n${scope} h1{font-size:var(--design-page-title-size);font-weight:var(--design-heading-weight);line-height:var(--design-line-height);letter-spacing:var(--design-letter-spacing)}\n${scope} p{font-size:var(--design-body-size);font-weight:var(--design-body-weight);line-height:var(--design-line-height)}\n${scope} .work-intro,${scope} .about-experience-intro,${scope} .contact-page__content>p:not(.work-eyebrow){font-size:var(--design-subheading-size)}\n${scope} .work-eyebrow,${scope} .about-eyebrow,${scope} .profile-copy__eyebrow{font-family:var(--site-font-accent);font-size:var(--design-subheading-size)}\n${scope} nav a{font-size:var(--design-nav-size)}\n${scope} button,${scope} .profile-button{font-size:var(--design-button-size);border-radius:var(--design-button-radius);background-color:var(--design-button-bg);color:var(--design-button-text)}\n${scope} a{color:var(--design-link)}\n${scope} .profile-copy__title{font-size:var(--design-hero-size)}\n${scope} h2,${scope} h3{font-size:var(--design-section-title-size)}\n${scope} .profile-detail,${scope} .featured-video,${scope} .category-card__button{background-color:var(--design-card-bg);border-color:var(--design-card-border);border-radius:var(--design-card-radius)}\n${scope}[data-button-style="solid"] .profile-button--outline{background:var(--site-accent);color:var(--site-text);border-color:var(--site-accent)}\n${scope}[data-button-style="solid"] .contact-page__footer button{background:var(--design-button-bg,var(--site-accent));color:var(--design-button-text,var(--site-text));border:1px solid var(--site-accent);padding:12px 18px}\n${scope}[data-button-style="outline"] .profile-button--solid{background:transparent;color:var(--site-text);border:1px solid var(--site-text)}\n${scope}[data-button-style="text"] button,${scope}[data-button-style="text"] .profile-button{border:0;background:transparent}\n@media(max-width:1000px){${scope} h1{font-size:var(--design-tablet-title)}${scope} .profile-copy__title{font-size:var(--design-tablet-hero)}}\n@media(max-width:600px){${scope} h1{font-size:var(--design-mobile-title)}${scope} .profile-copy__title{font-size:var(--design-mobile-hero)}}\n${sectionCss(design, target)}`;

  return (
    <div className="page-design-scope" data-page-design={target} data-button-style={design.buttons.style} style={{ ...variables, visibility: designReady ? undefined : "hidden" }}>
      <style>{scopedCss}</style>
      {children}
    </div>
  );
}
