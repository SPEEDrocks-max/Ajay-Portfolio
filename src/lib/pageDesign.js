import { supabase } from "./supabase";

export const DEFAULT_PAGE_DESIGN = {
  colors: { background: "", text: "", muted: "", accent: "", surface: "", border: "", button: "", buttonText: "", link: "" },
  typography: {
    headingFont: "", bodyFont: "", accentFont: "", heroSize: "", pageTitleSize: "", sectionTitleSize: "", subheadingSize: "", bodySize: "", navSize: "", buttonSize: "",
    headingWeight: "", bodyWeight: "", lineHeight: "", letterSpacing: "",
  },
  background: { mode: "solid", color: "", gradientStart: "", gradientEnd: "", imageUrl: "", imagePosition: "center", imageSize: "cover", overlay: 0, grain: "" },
  buttons: { style: "", radius: "" },
  cards: { background: "", border: "", radius: "" },
  responsive: { tabletScale: 0.85, mobileScale: 0.68 },
  sections: {},
};

export function mergePageDesign(...values) {
  const mergeDeep = (left, right) => {
    if (!right || typeof right !== "object" || Array.isArray(right)) return right;
    const output = left && typeof left === "object" && !Array.isArray(left) ? { ...left } : {};
    for (const [key, item] of Object.entries(right)) {
      output[key] = item && typeof item === "object" && !Array.isArray(item)
        ? mergeDeep(output[key], item)
        : item;
    }
    return output;
  };
  return values.reduce((result, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return result;
    return mergeDeep(result, value);
  }, {});
}

export function normalizePageDesign(value) {
  return mergePageDesign(DEFAULT_PAGE_DESIGN, value || {});
}

export function getDesignTarget(path) {
  if (path === "/about") return "about";
  if (path === "/work") return "work";
  if (path === "/contact") return "contact";
  if (path.startsWith("/work/")) return `category:${path.slice("/work/".length)}`;
  return "home";
}

export async function loadPublishedPageDesign(targetKey) {
  if (!supabase || !targetKey) return {};
  try {
    const { data, error } = await supabase.from("page_designs").select("design").eq("target_key", targetKey).eq("is_published", true).maybeSingle();
    if (error) return {};
    return data?.design || {};
  } catch {
    return {};
  }
}

function scopedFontFamily(font, field, target) {
  if (!font) return "";
  const externalFamily = typeof font === "object" && (font.family || font.name);
  const name = String(externalFamily || font.name || font).replace(/[^\p{L}\p{N} _-]/gu, "").trim();
  if (typeof font === "object" && (font.stylesheetUrl || (font.family && !font.url))) return name;
  const scope = String(target || "page").replace(/[^a-z0-9-]/gi, "-");
  return name ? `PortfolioDesign-${scope}-${field}-${name}` : "";
}

export function designToCssVariables(design, target) {
  const d = normalizePageDesign(design);
  const colors = d.colors;
  const typography = d.typography;
  const background = d.background;
  const vars = {
    "--site-bg": colors.background || background.color || undefined,
    "--site-background": background.mode === "gradient" && background.gradientStart && background.gradientEnd
      ? `linear-gradient(135deg, ${background.gradientStart}, ${background.gradientEnd})`
      : background.mode === "image" && background.imageUrl
        ? `linear-gradient(color-mix(in srgb, ${background.overlayColor || "#000000"} ${Number(background.overlay || 0)}%, transparent), color-mix(in srgb, ${background.overlayColor || "#000000"} ${Number(background.overlay || 0)}%, transparent)), url("${background.imageUrl.replace(/["\\\n\r]/g, "")}") ${background.imagePosition || "center"} / ${background.imageSize || "cover"} fixed`
        : colors.background || background.color || undefined,
    "--site-text": colors.text || undefined,
    "--site-muted": colors.muted || undefined,
    "--site-muted-text": colors.muted || undefined,
    "--site-accent": colors.accent || undefined,
    "--site-border": colors.border || undefined,
    "--site-grain-opacity": background.grain !== "" && Number.isFinite(Number(background.grain)) ? Number(background.grain) / 100 : undefined,
    "--design-tablet-title": typography.pageTitleSize ? `calc(${Number(typography.pageTitleSize)}px * ${Number(d.responsive.tabletScale) || 0.85})` : undefined,
    "--design-mobile-title": typography.pageTitleSize ? `calc(${Number(typography.pageTitleSize)}px * ${Number(d.responsive.mobileScale) || 0.68})` : undefined,
    "--design-tablet-hero": typography.heroSize ? `calc(${Number(typography.heroSize)}px * ${Number(d.responsive.tabletScale) || 0.85})` : undefined,
    "--design-mobile-hero": typography.heroSize ? `calc(${Number(typography.heroSize)}px * ${Number(d.responsive.mobileScale) || 0.68})` : undefined,
    "--site-font-heading": typography.headingFont ? `"${scopedFontFamily(typography.headingFont, "heading", target)}"` : undefined,
    "--site-font-body": typography.bodyFont ? `"${scopedFontFamily(typography.bodyFont, "body", target)}"` : undefined,
    "--site-font-accent": typography.accentFont ? `"${scopedFontFamily(typography.accentFont, "accent", target)}"` : undefined,
    "--design-hero-size": typography.heroSize ? `${typography.heroSize}px` : undefined,
    "--design-page-title-size": typography.pageTitleSize ? `${typography.pageTitleSize}px` : undefined,
    "--design-section-title-size": typography.sectionTitleSize ? `${typography.sectionTitleSize}px` : undefined,
    "--design-subheading-size": typography.subheadingSize ? `${typography.subheadingSize}px` : undefined,
    "--design-body-size": typography.bodySize ? `${typography.bodySize}px` : undefined,
    "--design-nav-size": typography.navSize ? `${typography.navSize}px` : undefined,
    "--design-button-size": typography.buttonSize ? `${typography.buttonSize}px` : undefined,
    "--design-heading-weight": typography.headingWeight || undefined,
    "--design-body-weight": typography.bodyWeight || undefined,
    "--design-line-height": typography.lineHeight || undefined,
    "--design-letter-spacing": typography.letterSpacing ? `${typography.letterSpacing}px` : undefined,
    "--design-button-bg": colors.button || undefined,
    "--design-button-text": colors.buttonText || undefined,
    "--design-link": colors.link || undefined,
    "--design-card-bg": d.cards.background || colors.surface || undefined,
    "--design-card-border": d.cards.border || undefined,
    "--design-button-radius": d.buttons.radius !== "" ? `${Number(d.buttons.radius)}px` : undefined,
    "--design-card-radius": d.cards.radius !== "" ? `${Number(d.cards.radius)}px` : undefined,
    "--design-tablet-scale": d.responsive.tabletScale || 0.85,
    "--design-mobile-scale": d.responsive.mobileScale || 0.68,
  };
  return Object.fromEntries(Object.entries(vars).filter(([, value]) => value !== undefined && value !== ""));
}

const FONT_BUCKET_EXTENSIONS = /\.(woff2?|ttf|otf)(?:\?|$)/i;
export function fontFaceCss(design, target) {
  const typography = normalizePageDesign(design).typography;
  const imports = new Set();
  const fontFaces = ["headingFont", "bodyFont", "accentFont"].map((key) => {
    const selected = typography[key];
    const font = typeof selected === "object" ? selected : null;
    if (font?.stylesheetUrl) {
      try {
        const stylesheet = new URL(font.stylesheetUrl);
        if (stylesheet.protocol === "https:" && !stylesheet.username && !stylesheet.password) imports.add(stylesheet.href);
      } catch { /* Ignore invalid external font stylesheet URLs. */ }
    }
    if (!font?.url || !FONT_BUCKET_EXTENSIONS.test(font.url)) return "";
    const family = scopedFontFamily(font, key.replace("Font", ""), target);
    const url = String(font.url).replace(/["\\\n\r]/g, "");
    return `@font-face{font-family:"${family}";src:url("${url}");font-display:swap}`;
  }).filter(Boolean);
  return [...[...imports].map((url) => `@import url(${JSON.stringify(url)});`), ...fontFaces].join("\n");
}
