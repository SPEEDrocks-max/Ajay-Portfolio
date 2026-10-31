export function getYouTubeId(url = "") {
  if (!url) return "";

  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, "");

    if (host === "youtu.be") return parsedUrl.pathname.slice(1).split("/")[0] || "";
    if (host.endsWith("youtube.com") || host === "youtube-nocookie.com") {
      const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
      if (parsedUrl.searchParams.has("v")) return parsedUrl.searchParams.get("v") || "";
      if (["embed", "shorts", "live"].includes(pathParts[0])) return pathParts[1] || "";
    }
  } catch {
    return "";
  }

  return "";
}

export function getProjectPoster(project) {
  if (project.thumbnail) return project.thumbnail;
  const videoId = getYouTubeId(project.youtubeUrl);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : "";
}

export function getYouTubeThumbnailCandidates(videoId) {
  if (!videoId) return [];

  return ["maxresdefault", "sddefault", "hqdefault", "mqdefault", "default"]
    .map((quality) => `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`);
}
