import { supabase } from "./supabase";

export const GLOBAL_SETTINGS_DRAFT_KEY = "portfolio-global-settings-draft-preview";

const SOCIAL_PLATFORMS = ["instagram", "linkedin", "youtube", "vimeo", "behance", "dribbble", "facebook", "other"];
export const DEFAULT_CONTACT_EMAIL = "acd@gmail.com";
export const DEFAULT_WHATSAPP_URL = "https://wa.me/917303806527";

export const DEFAULT_GLOBAL_SETTINGS = {
  identity: { websiteName: "", websiteTitle: "", description: "", logoUrl: "", faviconUrl: "", defaultShareImageUrl: "" },
  navigation: null,
  contact: { email: DEFAULT_CONTACT_EMAIL, phone: "", whatsappUrl: DEFAULT_WHATSAPP_URL, location: "", ctaHref: "" },
  socialLinks: SOCIAL_PLATFORMS.map((platform, order) => ({ id: platform, platform, label: platform === "other" ? "" : platform[0].toUpperCase() + platform.slice(1), url: "", enabled: false, order })),
  seo: { title: "", description: "", keywords: "", ogTitle: "", ogDescription: "", ogImageUrl: "", twitterImageUrl: "", canonicalDomain: "" },
  footer: { copyright: "", description: "", contactEmail: "", contactPhone: "", navigation: [], legalLinks: [] },
};

function text(value, maxLength = 2000) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export function isAssetUrl(value) {
  return typeof value === "string" && (value.startsWith("/") && !value.startsWith("//") || isHttpsUrl(value));
}

export function isInternalRoute(value) {
  return ["/", "/work", "/about", "/contact", "#selected-work", "#experience"].includes(value)
    || /^\/work\/[a-z0-9-]+$/.test(value || "");
}

export function isSafeNavigationItem(item) {
  if (!item?.enabled || !text(item.label, 80)) return false;
  return item.external ? isHttpsUrl(item.href) : isInternalRoute(item.href);
}

function normalizeLinkList(value, prefix) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 30).map((item, index) => ({
    id: text(item?.id, 100) || `${prefix}-${index + 1}`,
    label: text(item?.label, 80),
    href: text(item?.href, 500),
    external: Boolean(item?.external),
    enabled: item?.enabled !== false,
    order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
  }));
}

export function normalizeGlobalSettings(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const base = DEFAULT_GLOBAL_SETTINGS;
  const navigation = Array.isArray(input.navigation) ? normalizeLinkList(input.navigation, "nav") : null;
  const suppliedSocials = Array.isArray(input.socialLinks) ? input.socialLinks : [];
  const socialLinks = SOCIAL_PLATFORMS.map((platform, order) => {
    const saved = suppliedSocials.find((item) => item?.platform === platform || item?.id === platform) || {};
    const fallback = base.socialLinks[order];
    return {
      ...fallback,
      ...saved,
      id: platform === "other" ? text(saved.id, 100) || "other" : platform,
      platform,
      label: platform === "other" ? text(saved.label, 80) : fallback.label,
      url: text(saved.url, 500),
      enabled: saved.enabled === true,
      order: Number.isFinite(Number(saved.order)) ? Number(saved.order) : order,
    };
  });
  const otherLinks = suppliedSocials.filter((item) => item?.platform === "other" && item?.id && item.id !== "other").slice(0, 20).map((item, index) => ({
    id: text(item.id, 100), platform: "other", label: text(item.label, 80), url: text(item.url, 500), enabled: item.enabled === true,
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : SOCIAL_PLATFORMS.length + index,
  }));
  return {
    identity: {
      websiteName: text(input.identity?.websiteName, 120),
      websiteTitle: text(input.identity?.websiteTitle, 180),
      description: text(input.identity?.description, 320),
      logoUrl: text(input.identity?.logoUrl, 1000),
      faviconUrl: text(input.identity?.faviconUrl, 1000),
      defaultShareImageUrl: text(input.identity?.defaultShareImageUrl, 1000),
    },
    navigation,
    contact: {
      email: text(input.contact?.email, 254), phone: text(input.contact?.phone, 30),
      whatsappUrl: text(input.contact?.whatsappUrl, 500), location: text(input.contact?.location, 240),
      ctaHref: text(input.contact?.ctaHref, 500),
    },
    socialLinks: [...socialLinks, ...otherLinks].sort((a, b) => a.order - b.order),
    seo: {
      title: text(input.seo?.title, 180), description: text(input.seo?.description, 320), keywords: text(input.seo?.keywords, 500),
      ogTitle: text(input.seo?.ogTitle, 180), ogDescription: text(input.seo?.ogDescription, 320),
      ogImageUrl: text(input.seo?.ogImageUrl, 1000), twitterImageUrl: text(input.seo?.twitterImageUrl, 1000),
      canonicalDomain: text(input.seo?.canonicalDomain, 300),
    },
    footer: {
      copyright: text(input.footer?.copyright, 180), description: text(input.footer?.description, 500),
      contactEmail: text(input.footer?.contactEmail, 254), contactPhone: text(input.footer?.contactPhone, 30),
      navigation: normalizeLinkList(input.footer?.navigation, "footer"),
      legalLinks: normalizeLinkList(input.footer?.legalLinks, "legal"),
    },
  };
}

let publishedSettingsRequest;
const pageSeoCache = new Map();

export function loadPublishedGlobalSettings() {
  if (!supabase) return Promise.resolve({ settings: normalizeGlobalSettings({}), configured: false });
  if (!publishedSettingsRequest) {
    publishedSettingsRequest = supabase.from("site_settings").select("public_content").limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (error || !data?.public_content || typeof data.public_content !== "object") return { settings: normalizeGlobalSettings({}), configured: false };
        return { settings: normalizeGlobalSettings(data.public_content), configured: true };
      })
      .catch(() => ({ settings: normalizeGlobalSettings({}), configured: false }));
  }
  return publishedSettingsRequest;
}

export function loadPublishedPageSeo(slug) {
  if (!supabase || !slug) return Promise.resolve(null);
  if (!pageSeoCache.has(slug)) {
    const request = supabase.from("pages").select("seo_title,seo_description").eq("slug", slug).eq("is_published", true).maybeSingle()
      .then(({ data, error }) => error ? null : data)
      .catch(() => null);
    pageSeoCache.set(slug, request);
  }
  return pageSeoCache.get(slug);
}
