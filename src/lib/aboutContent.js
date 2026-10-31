import experiencesData from "../data/about/experience.json";
import specializationsData from "../data/about/specializations.json";
import toolsData from "../data/about/tools.json";
import { supabase } from "./supabase";

function cleanEntries(entries, hasContent) {
  return entries.filter(hasContent).map((item, index) => ({ ...item, sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index })).sort((a, b) => a.sortOrder - b.sortOrder);
}

export const DEFAULT_ABOUT_CONTENT = {
  topbarName: "AJAY MEHTA",
  topbarRole: "VIDEO EDITOR & STORYTELLER",
  experienceEyebrow: "CAREER TIMELINE",
  experienceTitle: "Experience",
  experienceIntro: "The work behind the stories, frame by frame.",
  experienceEmptyText: "Professional experience details are being added.",
  portraitUrl: "/images/ajay-portrait.png",
  portraitAlt: "Ajay Mehta",
  portraitCaption: "AJAY MEHTA",
  youtubeBannerUrl: "",
  portraitEmptyKicker: "PORTRAIT STUDY / 01",
  portraitInitials: "AM",
  portraitEmptyCaption: "AJAY MEHTA · VIDEO EDITOR",
  experienceFolio: "01 / EXPERIENCE",
  toolsTitle: "Tools",
  toolsAccent: "I use",
  toolsHint: "Hover or tap to explore",
  toolsOpenHint: "Click to close",
  specializationsTitle: "What I make",
  specializationsEmptyText: "Selected formats and focus areas will be listed here.",
  toolsEmptyText: "Software tools will be listed here.",
  toolsFolio: "02 / WHAT I MAKE",
  footerName: "AJAY MEHTA",
  footerRole: "VIDEO EDITOR & STORYTELLER",
  footerReturnLabel: "RETURN HOME ↑",
  experiences: cleanEntries(experiencesData, (item) => item.company || item.role || item.description),
  tools: cleanEntries(toolsData, (item) => item.name),
  specializations: cleanEntries(specializationsData, (item) => item.title),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeAboutContent(value) {
  let saved = value;
  if (Array.isArray(value)) saved = value.find((section) => section?.id === "about")?.content;
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return clone(DEFAULT_ABOUT_CONTENT);
  return {
    ...clone(DEFAULT_ABOUT_CONTENT),
    ...saved,
    experiences: Array.isArray(saved.experiences) ? cleanEntries(saved.experiences, (item) => item.company || item.role || item.description) : clone(DEFAULT_ABOUT_CONTENT.experiences),
    tools: Array.isArray(saved.tools) ? cleanEntries(saved.tools, (item) => item.name) : clone(DEFAULT_ABOUT_CONTENT.tools),
    specializations: Array.isArray(saved.specializations) ? cleanEntries(saved.specializations, (item) => item.title) : clone(DEFAULT_ABOUT_CONTENT.specializations),
  };
}

let publishedAboutRequest;

export function loadPublishedAboutContent() {
  if (!supabase) return Promise.resolve(clone(DEFAULT_ABOUT_CONTENT));
  if (!publishedAboutRequest) {
    publishedAboutRequest = supabase
      .from("pages")
      .select("sections")
      .eq("slug", "about")
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data, error }) => error || !data?.sections ? clone(DEFAULT_ABOUT_CONTENT) : normalizeAboutContent(data.sections))
      .catch(() => clone(DEFAULT_ABOUT_CONTENT));
  }
  return publishedAboutRequest;
}

export function serializeAboutContent(content) {
  return [{ id: "about", enabled: true, order: 0, content: normalizeAboutContent(content) }];
}

export function cloneAboutContent(content = DEFAULT_ABOUT_CONTENT) {
  return clone(content);
}
