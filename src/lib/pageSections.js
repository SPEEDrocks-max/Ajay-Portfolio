import { supabase } from "./supabase";

const COMMON_FOOTER_FIELDS = [
  { key: "name", label: "Footer name", defaultValue: "AJAY MEHTA" },
  { key: "role", label: "Footer role", defaultValue: "VIDEO EDITOR & STORYTELLER" },
  { key: "returnLabel", label: "Return link label", defaultValue: "RETURN HOME ↑" },
];

export const SECTION_TEMPLATES = {
  home: [
    { type: "home-hero", label: "Introduction & profile", unique: true, sourceId: "hero", fields: [{ key: "title", label: "Main heading", defaultValue: "VIDEO EDITOR &" }, { key: "accentTitle", label: "Accent heading", defaultValue: "STORYTELLER" }, { key: "descriptionContinuation", label: "Supporting text", defaultValue: "with editorial thinking and AI-powered workflows." }, { key: "buttonLabel", label: "Primary button label", defaultValue: "CONTACT ME" }, { key: "buttonHref", label: "Primary button destination", defaultValue: "/contact" }] },
    { type: "client-logos", label: "Worked with / client logos", unique: true, sourceId: "company-logos", fields: [{ key: "title", label: "Section heading", defaultValue: "WORKED WITH" }] },
    { type: "featured-work", label: "Featured work", duplicateable: true, sourceId: "featured-work", fields: [{ key: "eyebrow", label: "Eyebrow", defaultValue: "A SELECTION OF PROJECTS" }, { key: "title", label: "Section heading", defaultValue: "Work" }, { key: "moreLabel", label: "Work link label", defaultValue: "SHOW MORE WORK" }] },
  ],
  about: [
    { type: "about-experience", label: "Experience timeline & portrait", unique: true, fields: [{ key: "experienceTitle", label: "Section heading", defaultValue: "Experience" }, { key: "experienceIntro", label: "Supporting text", defaultValue: "The work behind the stories, frame by frame." }] },
    { type: "about-tools", label: "Tools & specializations", unique: true, fields: [{ key: "toolsTitle", label: "Tools heading", defaultValue: "Tools" }, { key: "toolsAccent", label: "Heading accent", defaultValue: "I use" }, { key: "specializationsTitle", label: "Specializations heading", defaultValue: "What I make" }] },
    { type: "about-footer", label: "About footer", unique: true, fixedLast: true, fields: COMMON_FOOTER_FIELDS },
  ],
  work: [
    { type: "work-header", label: "Work introduction", unique: true, fields: [{ key: "heading", label: "Main heading", defaultValue: "Moving images,\nshaped with intent." }, { key: "intro", label: "Supporting text", defaultValue: "Editorial storytelling across formats. Explore selected work by discipline." }] },
    { type: "category-grid", label: "Category grid", unique: true, fields: [] },
    { type: "work-footer", label: "Work footer", unique: true, fields: COMMON_FOOTER_FIELDS },
  ],
  "category-detail": [
    { type: "category-header", label: "Category introduction", unique: true, fields: [{ key: "eyebrow", label: "Eyebrow", defaultValue: "SELECTED WORK" }, { key: "heading", label: "Heading override (optional)", defaultValue: "" }, { key: "description", label: "Description override (optional)", defaultValue: "" }] },
    { type: "video-grid", label: "Existing category videos", unique: true, fields: [] },
    { type: "category-footer", label: "Category footer", unique: true, fields: COMMON_FOOTER_FIELDS },
  ],
  contact: [
    { type: "contact-header", label: "Contact header", unique: true, fields: [] },
    { type: "contact-content", label: "Contact information", unique: true, fields: [{ key: "heading", label: "Main heading", defaultValue: "Have a story\nto shape?" }, { key: "description", label: "Supporting text", defaultValue: "For project enquiries and collaborations, get in touch." }, { key: "note", label: "Contact note", defaultValue: "Contact details will appear here." }] },
    { type: "contact-footer", label: "Contact footer", unique: true, fields: [{ key: "returnLabel", label: "Return link label", defaultValue: "RETURN HOME ↑" }] },
  ],
};

const DEFAULT_SECTION_IDS = {
  home: [["home-hero", "hero"], ["client-logos", "company-logos"], ["featured-work", "featured-work"]],
  about: [["about-experience", "about-experience"], ["about-tools", "about-tools"], ["about-footer", "about-footer"]],
  work: [["work-header", "work-header"], ["category-grid", "category-grid"], ["work-footer", "work-footer"]],
  "category-detail": [["category-header", "category-header"], ["video-grid", "video-grid"], ["category-footer", "category-footer"]],
  contact: [["contact-header", "contact-header"], ["contact-content", "contact-content"], ["contact-footer", "contact-footer"]],
};

export function getSectionPageKey(targetKey) {
  return targetKey.startsWith("category:") ? "category-detail" : targetKey;
}

export function createDefaultSectionConfig(targetKey, homeContent) {
  const pageKey = getSectionPageKey(targetKey);
  if (pageKey === "home" && Array.isArray(homeContent)) {
    return [...homeContent].sort((a, b) => a.order - b.order).map((section, index) => {
      const mapped = { hero: "home-hero", "company-logos": "client-logos", "featured-work": "featured-work" }[section.id];
      if (!mapped) return null;
      return { id: mapped, type: mapped, sourceId: section.id, enabled: section.enabled !== false, order: index, content: {} };
    }).filter(Boolean);
  }
  return (DEFAULT_SECTION_IDS[pageKey] || []).map(([type, sourceId], order) => ({ id: type, type, sourceId, enabled: true, order, content: {} }));
}

export function normalizeSectionConfig(value, targetKey) {
  if (!Array.isArray(value)) return null;
  const templates = SECTION_TEMPLATES[getSectionPageKey(targetKey)] || [];
  const allowed = new Map(templates.map((template) => [template.type, template]));
  const seenIds = new Set();
  const seenUniqueTypes = new Set();
  const normalized = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object" || !allowed.has(item.type)) return;
    const template = allowed.get(item.type);
    const id = typeof item.id === "string" && /^[a-z0-9-]{1,100}$/.test(item.id) ? item.id : `${item.type}-${index + 1}`;
    if (seenIds.has(id)) return;
    if (template.unique && seenUniqueTypes.has(item.type)) return;
    seenIds.add(id);
    seenUniqueTypes.add(item.type);
    const content = {};
    for (const field of template.fields) {
      const input = item.content?.[field.key];
      if (typeof input === "string" && input.trim()) content[field.key] = input.slice(0, 2000);
    }
    normalized.push({ id, type: item.type, sourceId: template.sourceId || item.type, enabled: item.enabled !== false, order: Number.isFinite(Number(item.order)) ? Number(item.order) : index, content });
  });
  if (value.length && normalized.length === 0) return null;
  return normalized.sort((a, b) => a.order - b.order).map((item, index) => ({ ...item, order: index }));
}

export async function loadPublishedSectionConfig(targetKey) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from("page_section_configs").select("sections").eq("target_key", targetKey).eq("is_published", true).maybeSingle();
    if (error || !data) return null;
    return normalizeSectionConfig(data.sections, targetKey);
  } catch { return null; }
}
