import aiVideos from "./ai-videos.json";
import motionGraphics from "./motion-graphics.json";
import reelsShorts from "./reels-shorts.json";
import explainerVideos from "./explainer-videos.json";
import launchingVideos from "./launching-videos.json";
import showsInterviews from "./shows-interviews.json";
import animationVideos from "./animation-videos.json";
import productVideos from "./product-videos.json";

const categoryFiles = [
  aiVideos,
  motionGraphics,
  reelsShorts,
  explainerVideos,
  launchingVideos,
  showsInterviews,
  animationVideos,
  productVideos,
];

export const categories = categoryFiles.map((category) => ({
  ...category,
  videos: category.videos.filter((video) =>
    [video.title, video.url, video.youtubeUrl, video.thumbnail].some((value) => typeof value === "string" && value.trim()),
  ),
}));

export const categoriesBySlug = Object.fromEntries(
  categories.map((category) => [category.slug, category]),
);
