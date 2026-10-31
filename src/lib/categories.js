import { categories as staticCategories } from "../data/categories";
import { supabase } from "./supabase";

const STATIC_BY_SLUG = Object.fromEntries(staticCategories.map((category) => [category.slug, category]));
let publishedCategoriesRequest;
let publishedVideosRequest;

function mergeCategory(row) {
  const fallback = STATIC_BY_SLUG[row.slug];
  return {
    ...(fallback || {}),
    id: row.id || fallback?.id || row.slug,
    slug: row.slug,
    title: row.title,
    description: row.description || fallback?.description || "",
    thumbnail: row.thumbnail_url || fallback?.thumbnail || "",
    thumbnailUrl: row.thumbnail_url || "",
    displayOrder: Number.isFinite(row.display_order) ? row.display_order : fallback?.displayOrder || 0,
    isVisible: row.is_visible !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    videos: fallback?.videos || [],
    videoCatalogMigrated: false,
  };
}

function mergeDatabaseVideo(row) {
  const provider = row.provider === "google_drive" ? "googleDrive" : row.provider;
  return {
    id: row.id,
    recordId: row.id,
    videoId: row.video_id || "",
    playbackId: row.playback_id || "",
    provider,
    url: row.video_url,
    title: row.title,
    description: row.description || "",
    thumbnail: row.thumbnail_url || "",
    isFeatured: row.is_featured,
    displayOrder: row.display_order,
    processingStatus: row.processing_status,
  };
}

async function loadPublishedCategoryMetadata() {
  if (!supabase) return staticCategories;
  const { data: rows, error } = await supabase
    .from("categories")
    .select("id,title,slug,description,thumbnail_url,display_order,is_visible,created_at,updated_at")
    .eq("is_visible", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return staticCategories;

  const mapped = (rows || []).map(mergeCategory);
  const { data: settings, error: settingsError } = await supabase
    .from("site_settings")
    .select("video_catalog_migrated")
    .limit(1)
    .maybeSingle();
  const databaseVideosAreAuthoritative = !settingsError && Boolean(settings?.video_catalog_migrated);
  return mapped.map((category) => ({
    ...category,
    videoCatalogMigrated: databaseVideosAreAuthoritative,
    ...(databaseVideosAreAuthoritative ? { videos: [] } : {}),
  }));
}

async function loadVideosForCategories(categories) {
  if (!categories.some((category) => category.videoCatalogMigrated)) return categories;
  if (!publishedVideosRequest) {
    publishedVideosRequest = supabase
      .from("videos")
      .select("id,title,description,provider,video_url,video_id,thumbnail_url,category_id,playback_id,processing_status,is_featured,display_order")
      .eq("is_visible", true)
      .eq("processing_status", "ready")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data, error }) => error ? null : data)
      .catch(() => null);
  }
  const videoRows = await publishedVideosRequest;
  if (!videoRows) return categories.map((category) => ({ ...category, videos: STATIC_BY_SLUG[category.slug]?.videos || [] }));
  const videosByCategory = new Map();
  for (const row of videoRows) {
    const list = videosByCategory.get(row.category_id) || [];
    list.push(mergeDatabaseVideo(row));
    videosByCategory.set(row.category_id, list);
  }
  return categories.map((category) => ({ ...category, videos: videosByCategory.get(category.id) || [] }));
}

export function loadPublishedCategories({ includeVideos = false } = {}) {
  if (!supabase) return Promise.resolve(staticCategories);
  if (!publishedCategoriesRequest) publishedCategoriesRequest = loadPublishedCategoryMetadata().catch(() => staticCategories);
  if (includeVideos) return publishedCategoriesRequest.then(loadVideosForCategories).catch(() => staticCategories);
  return publishedCategoriesRequest;
}

export function clearPublishedCategoriesCache() {
  publishedCategoriesRequest = undefined;
  publishedVideosRequest = undefined;
}

export function getStaticCategory(slug) {
  return STATIC_BY_SLUG[slug];
}
