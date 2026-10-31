import { supabase } from "./supabase";

export const DEFAULT_HOME_CONTENT = [
  {
    id: "hero",
    enabled: true,
    order: 0,
    content: {
      initials: "AM",
      railName: "AJAY MEHTA",
      pageLabel: "P. 01",
      headerRole: "VIDEO EDITOR, STORYTELLER",
      navigation: [
        { label: "SELECTED WORK", href: "#selected-work" },
        { label: "ABOUT", href: "/about" },
        { label: "EXPERIENCE", href: "#experience" },
        { label: "CONTACT", href: "/contact" },
      ],
      profileImageUrl: "/images/ajay-portrait.png",
      statValue: "7+",
      statCaption: "Years of Experience",
      eyebrow: "THE EDITOR / STORYTELLER",
      title: "VIDEO EDITOR &",
      accentTitle: "STORYTELLER",
      descriptionHighlight: "Transforming raw footage into high-impact visual narratives",
      descriptionContinuation: "with editorial thinking and AI-powered workflows.",
      details: [
        { label: "Video editing & storytelling", value: "VIDEO" },
        { label: "High-impact visual narratives", value: "EDITORIAL" },
        { label: "AI-powered workflows", value: "AI" },
      ],
      buttonLabel: "CONTACT ME",
      buttonHref: "/contact",
      secondaryButtonLabel: "READ THE WORK",
      secondaryButtonHref: "#selected-work",
    },
  },
  {
    id: "company-logos",
    enabled: true,
    order: 1,
    content: {
      title: "WORKED WITH",
      logos: [
        { name: "Rio", logoUrl: "/Company%20Logos/1.png", url: "" },
        { name: "Inc42", logoUrl: "/Company%20Logos/2%20Inc42.png", url: "" },
        { name: "Times Internet", logoUrl: "/Company%20Logos/3%20Times%20Internt%20Logo.png", url: "" },
        { name: "Business Standard", logoUrl: "/Company%20Logos/4%20Business%20Standard.png", url: "" },
        { name: "To The New", logoUrl: "/Company%20Logos/5%20To%20The%20new.png", url: "" },
        { name: "Prabhat Prakashan", logoUrl: "/Company%20Logos/6%20Prabhat%20Prakashan.png", url: "" },
      ],
    },
  },
  {
    id: "featured-work",
    enabled: true,
    order: 2,
    content: {
      eyebrow: "A SELECTION OF PROJECTS",
      title: "Work",
      moreLabel: "SHOW MORE WORK",
      video: {
        title: "Delhi to Barog — Solo Bike Ride",
        url: "https://vimeo.com/1150840402?fl=tl&fe=ec",
        client: "",
        year: "",
        description: "",
        thumbnail: "",
      },
    },
  },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function normalizeHomeContent(value) {
  const savedSections = Array.isArray(value) ? value : [];
  const normalized = DEFAULT_HOME_CONTENT.map((defaults) => {
    const saved = savedSections.find((section) => section?.id === defaults.id);
    const content = saved?.content && typeof saved.content === "object" ? saved.content : {};
    return {
      ...clone(defaults),
      ...(saved || {}),
      id: defaults.id,
      enabled: typeof saved?.enabled === "boolean" ? saved.enabled : defaults.enabled,
      order: Number.isFinite(saved?.order) ? saved.order : defaults.order,
      content: { ...clone(defaults.content), ...content },
    };
  });
  return normalized.sort((left, right) => left.order - right.order);
}

let publishedHomeRequest;

export function loadPublishedHomeContent() {
  if (!supabase) return Promise.resolve(clone(DEFAULT_HOME_CONTENT));
  if (!publishedHomeRequest) {
    publishedHomeRequest = supabase
      .from("pages")
      .select("sections")
      .eq("slug", "home")
      .eq("is_published", true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data?.sections) return clone(DEFAULT_HOME_CONTENT);
        return normalizeHomeContent(data.sections);
      })
      .catch(() => clone(DEFAULT_HOME_CONTENT));
  }
  return publishedHomeRequest;
}

export function cloneHomeContent(value = DEFAULT_HOME_CONTENT) {
  return clone(value);
}
