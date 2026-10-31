import { useEffect, useMemo, useState } from "react";
import FeaturedVideoCard from "../../Pages/Landing/FeaturedVideoCard";
import { getYouTubeId } from "../../Pages/Work/projects";
import { supabase } from "../../lib/supabase";
import MediaUploadField from "../components/MediaUploadField";

const PROVIDERS = [
  { id: "youtube", label: "YouTube" },
  { id: "vimeo", label: "Vimeo" },
  { id: "google_drive", label: "Google Drive" },
  { id: "direct", label: "Direct video URL" },
  { id: "cloudflare", label: "Cloudflare Stream upload" },
];
const VIDEO_COLUMNS = "id,title,description,provider,video_url,video_id,thumbnail_url,category_id,playback_id,processing_status,is_featured,is_visible,display_order,created_at,updated_at";
const DRAFT_COLUMNS = "id,video_id,title,description,provider,video_url,video_id_external,thumbnail_url,category_id,playback_id,processing_status,is_featured,display_order,created_at,updated_at";
const MAX_UPLOAD_BYTES = 30 * 1024 * 1024 * 1024;
const TUS_CHUNK_BYTES = 50 * 1024 * 1024;

function providerLabel(value) { return PROVIDERS.find((provider) => provider.id === value)?.label || value || "Unknown"; }

function externalIdFor(provider, url) {
  if (provider === "youtube") return getYouTubeId(url);
  if (provider === "vimeo") {
    try {
      const parsed = new URL(url);
      if (!/(^|\.)vimeo\.com$/i.test(parsed.hostname)) return "";
      return parsed.pathname.match(/\/(?:video\/)?(\d+)/)?.[1] || "";
    } catch { return ""; }
  }
  if (provider === "google_drive") {
    try {
      const parsed = new URL(url);
      if (!/^(drive|docs)\.google\.com$/i.test(parsed.hostname)) return "";
      return parsed.pathname.match(/\/file\/d\/([^/]+)/)?.[1] || parsed.searchParams.get("id") || "";
    } catch { return ""; }
  }
  if (provider === "cloudflare") return url.trim();
  return "";
}

function validateVideo(video) {
  if (!video.title.trim()) return "Add a video title.";
  if (!video.category_id) return "Choose a category.";
  if (!video.display_order || !Number.isInteger(Number(video.display_order)) || Number(video.display_order) < 1) return "Display order must be a positive whole number.";
  if (video.provider === "cloudflare") {
    const uid = video.playback_id || video.video_url;
    if (!/^[a-f\d]{16,64}$/i.test(uid || "")) return "Upload a video to Cloudflare Stream before saving it.";
    if (video.processing_status === "failed") return "This Cloudflare upload failed. Upload the file again before publishing.";
    return "";
  }
  let parsed;
  try { parsed = new URL(video.video_url); } catch { return "Enter a valid video URL."; }
  if (parsed.protocol !== "https:") return "Use a secure HTTPS video link.";
  if (video.provider === "youtube" && !getYouTubeId(video.video_url)) return "Enter a YouTube watch, short, Shorts, or embed link.";
  if (video.provider === "vimeo" && !externalIdFor("vimeo", video.video_url)) return "Enter a valid Vimeo video link. Unlisted video hashes are kept in the saved URL.";
  if (video.provider === "google_drive" && !externalIdFor("google_drive", video.video_url)) return "Enter a Google Drive file share link.";
  if (video.provider === "direct" && !/\.(mp4|webm)$/i.test(parsed.pathname)) return "Direct video links must point to an MP4 or WebM file.";
  return "";
}

function getErrorMessage(error, action) {
  if (error?.code === "23505") return "A video with this provider ID is already in that category.";
  if (error?.code === "23503") return "The selected category is no longer available. Reload categories and try again.";
  if (error?.code === "42501" || error?.status === 401 || error?.status === 403) return "Your admin session may have expired, or the video manager database migration is pending.";
  if (/video_drafts|schema cache|does not exist/i.test(error?.message || "")) return "Apply the Phase 7 Video Manager migration in Supabase before using this page.";
  return error?.message || `Could not ${action}. Please try again.`;
}

function mapDraftToForm(draft, categoryTitle = "") {
  return {
    id: draft.video_id || null,
    draftId: draft.id || null,
    title: draft.title || "",
    description: draft.description || "",
    provider: draft.provider || "youtube",
    video_url: draft.video_url || "",
    video_id: draft.video_id_external || draft.video_id || "",
    thumbnail_url: draft.thumbnail_url || "",
    category_id: draft.category_id || "",
    categoryTitle,
    playback_id: draft.playback_id || "",
    processing_status: draft.processing_status || "ready",
    is_featured: Boolean(draft.is_featured),
    is_visible: draft.is_visible !== false,
    display_order: Number.isFinite(draft.display_order) ? draft.display_order : 1,
  };
}

function buildDraftPayload(editor) {
  const externalId = editor.provider === "cloudflare" ? (editor.playback_id || editor.video_url) : externalIdFor(editor.provider, editor.video_url);
  return {
    ...(editor.draftId ? { id: editor.draftId } : {}),
    video_id: editor.id || null,
    title: editor.title.trim(),
    description: editor.description.trim() || null,
    provider: editor.provider,
    video_url: editor.provider === "cloudflare" ? (editor.playback_id || editor.video_url).trim() : editor.video_url.trim(),
    video_id_external: externalId || null,
    thumbnail_url: editor.thumbnail_url.trim() || null,
    category_id: editor.category_id,
    playback_id: editor.provider === "cloudflare" ? (editor.playback_id || externalId) : null,
    processing_status: editor.processing_status || "ready",
    is_featured: Boolean(editor.is_featured),
    display_order: Number(editor.display_order),
  };
}

function makeListing(videos, drafts, categories) {
  const draftByVideo = new Map(drafts.filter((draft) => draft.video_id).map((draft) => [draft.video_id, draft]));
  const entries = videos.map((video) => {
    const draft = draftByVideo.get(video.id);
    return {
      ...video,
      categoryTitle: categories.find((category) => category.id === video.category_id)?.title || "Category unavailable",
      draftId: draft?.id || null,
      draftData: draft || null,
      displayTitle: draft?.title || video.title,
      displayThumbnail: draft?.thumbnail_url || video.thumbnail_url,
      entryType: "published-record",
    };
  });
  drafts.filter((draft) => !draft.video_id).forEach((draft) => {
    entries.push({
      ...draft,
      id: null,
      video_id_external: draft.video_id_external,
      categoryTitle: categories.find((category) => category.id === draft.category_id)?.title || "Category unavailable",
      draftId: draft.id,
      draftData: draft,
      displayTitle: draft.title,
      displayThumbnail: draft.thumbnail_url,
      entryType: "draft-only",
      is_visible: false,
      display_order: Number(draft.display_order) || 1,
    });
  });
  return entries.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.displayTitle.localeCompare(b.displayTitle));
}

function xhrRequest({ url, method, headers = {}, body, onProgress }) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    Object.entries(headers).forEach(([name, value]) => request.setRequestHeader(name, value));
    if (onProgress) request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded, event.total); };
    request.onerror = () => reject(new Error("Upload connection interrupted. Retry the upload to resume where supported."));
    request.onabort = () => reject(new Error("Upload cancelled."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve(request);
      else reject(new Error(`Cloudflare upload failed (${request.status}). ${request.responseText?.slice(0, 240) || "Please retry."}`));
    };
    request.send(body);
  });
}

async function getTusOffset(uploadUrl) {
  const response = await fetch(uploadUrl, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" } });
  if (!response.ok) throw new Error("Could not resume the Cloudflare upload. Start the upload again.");
  return Number(response.headers.get("Upload-Offset") || 0);
}

async function uploadWithTus(uploadUrl, file, onProgress) {
  let offset = await getTusOffset(uploadUrl).catch(() => 0);
  while (offset < file.size) {
    const start = offset;
    const end = Math.min(start + TUS_CHUNK_BYTES, file.size);
    const chunk = file.slice(start, end);
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await xhrRequest({
          url: uploadUrl,
          method: "PATCH",
          headers: { "Tus-Resumable": "1.0.0", "Upload-Offset": String(start), "Content-Type": "application/offset+octet-stream" },
          body: chunk,
          onProgress: (loaded) => onProgress(Math.min(start + loaded, file.size), file.size),
        });
        offset = Number(response.getResponseHeader("Upload-Offset")) || end;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        try { offset = await getTusOffset(uploadUrl); } catch { offset = start; }
        if (offset > start) { lastError = null; break; }
        await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    if (lastError) throw lastError;
  }
}

export default function VideoManager() {
  const [videos, setVideos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editor, setEditor] = useState(null);
  const [editorBaseline, setEditorBaseline] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFile, setUploadFile] = useState(null);
  const [isCheckingCloudflare, setIsCheckingCloudflare] = useState(false);

  const listing = useMemo(() => makeListing(videos, drafts, categories), [videos, drafts, categories]);
  const visibleItems = useMemo(() => listing.filter((video) => {
    const provider = video.draftData?.provider || video.provider;
    const isDraftOnly = video.entryType === "draft-only";
    const hasDraftChanges = Boolean(video.draftId && !isDraftOnly);
    const published = !isDraftOnly && video.is_visible;
    const hidden = !isDraftOnly && !video.is_visible;
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "draft" && isDraftOnly)
      || (statusFilter === "draft-changes" && hasDraftChanges)
      || (statusFilter === "published" && published)
      || (statusFilter === "hidden" && hidden);
    return video.displayTitle.toLowerCase().includes(search.trim().toLowerCase())
      && (categoryFilter === "all" || video.category_id === categoryFilter)
      && (providerFilter === "all" || provider === providerFilter)
      && matchesStatus;
  }), [listing, search, categoryFilter, providerFilter, statusFilter]);

  async function loadData() {
    setIsLoading(true);
    setError("");
    try {
      const [categoryResult, videoResult, draftResult] = await Promise.all([
        supabase.from("categories").select("id,title,slug,is_visible").order("display_order", { ascending: true }),
        supabase.from("videos").select(VIDEO_COLUMNS).order("category_id", { ascending: true }).order("display_order", { ascending: true }),
        supabase.from("video_drafts").select(DRAFT_COLUMNS).order("updated_at", { ascending: false }),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (videoResult.error) throw videoResult.error;
      if (draftResult.error) throw draftResult.error;
      setCategories(categoryResult.data || []);
      setVideos(videoResult.data || []);
      setDrafts(draftResult.data || []);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "load the video list"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openEditor(item = null) {
    const category = categories[0];
    const nextOrder = listing.filter((entry) => entry.category_id === category?.id).reduce((maximum, entry) => Math.max(maximum, Number(entry.display_order) || 0), 0) + 1;
    const defaultData = {
      id: null, draftId: null, title: "", description: "", provider: "youtube", video_url: "", video_id: "", thumbnail_url: "",
      category_id: category?.id || "", categoryTitle: category?.title || "", playback_id: "", processing_status: "ready", is_featured: false,
      is_visible: true, display_order: nextOrder,
    };
    const value = item
      ? mapDraftToForm(item.draftData || item, item.categoryTitle)
      : defaultData;
    if (item && item.draftData) {
      value.id = item.id || item.video_id || null;
      value.draftId = item.draftId || item.id || null;
      value.video_id = item.draftData.video_id_external || item.draftData.video_id || item.video_id || "";
      if (item.entryType !== "draft-only") value.id = item.id;
    } else if (item) {
      value.id = item.id;
      value.draftId = item.draftId;
      value.video_id = item.video_id || "";
    }
    setEditor(value);
    setEditorBaseline(JSON.stringify(value));
    setUploadFile(null);
    setUploadProgress(0);
    setError("");
    setNotice("");
  }

  function updateEditor(field, value) {
    if (field === "category_id") {
      const category = categories.find((entry) => entry.id === value);
      const nextOrder = listing.filter((entry) => entry.category_id === value).reduce((maximum, entry) => Math.max(maximum, Number(entry.display_order) || 0), 0) + 1;
      setEditor((current) => ({ ...current, category_id: value, categoryTitle: category?.title || "", ...(!current.id ? { display_order: nextOrder } : {}) }));
    } else setEditor((current) => ({ ...current, [field]: value }));
    setError("");
    setNotice("");
  }

  function validateEditor() {
    if (!editor) return false;
    const message = validateVideo(editor);
    if (message) { setError(message); return false; }
    const externalId = editor.provider === "cloudflare" ? (editor.playback_id || editor.video_url) : externalIdFor(editor.provider, editor.video_url);
    const duplicate = [...videos, ...drafts.filter((draft) => !draft.video_id || draft.video_id !== editor.id)].some((existing) => {
      const existingProvider = existing.provider;
      const existingCategory = existing.category_id;
      const existingUrl = existing.video_url;
      const existingId = externalIdFor(existing.provider, existing.video_url) || existing.video_id_external || existing.video_id;
      const existingRef = existing.id;
      const isCurrentVideo = existing.id === editor.id || existing.id === editor.draftId || (existing.video_id && existing.video_id === editor.id);
      const sameExternalId = externalId && existingId && (editor.provider === "youtube"
        ? String(existingId).toLowerCase() === String(externalId).toLowerCase()
        : existingId === externalId);
      return !isCurrentVideo && existingCategory === editor.category_id && existingProvider === editor.provider
        && (existingUrl === editor.video_url || sameExternalId)
        && existingRef !== editor.id;
    });
    if (duplicate) { setError("This video already exists in the selected category."); return false; }
    return true;
  }

  async function saveDraft() {
    if (!validateEditor()) return;
    setIsSaving(true);
    setError("");
    try {
      const payload = buildDraftPayload(editor);
      let result;
      if (editor.draftId) result = await supabase.from("video_drafts").update(payload).eq("id", editor.draftId).select(DRAFT_COLUMNS).single();
      else result = await supabase.from("video_drafts").insert(payload).select(DRAFT_COLUMNS).single();
      if (result.error) throw result.error;
      const saved = mapDraftToForm(result.data, categories.find((category) => category.id === editor.category_id)?.title);
      saved.id = editor.id || null;
      saved.video_id = result.data.video_id_external || "";
      saved.draftId = result.data.id;
      setEditor(saved);
      setEditorBaseline(JSON.stringify(saved));
      setNotice("Draft saved. The public video is unchanged until you publish.");
      await loadData();
    } catch (saveError) {
      setError(getErrorMessage(saveError, "save this draft"));
    } finally {
      setIsSaving(false);
    }
  }

  async function publishVideo() {
    if (!validateEditor()) return;
    if (editor.provider === "cloudflare" && editor.processing_status !== "ready") {
      setError("Cloudflare is still processing this video. Check its status and publish after it is ready.");
      return;
    }
    if (!window.confirm(`Publish “${editor.title.trim()}” in ${categories.find((category) => category.id === editor.category_id)?.title || "the selected category"}?`)) return;
    setIsSaving(true);
    setError("");
    try {
      const payload = {
        title: editor.title.trim(),
        description: editor.description.trim() || null,
        provider: editor.provider,
        video_url: editor.provider === "cloudflare" ? (editor.playback_id || editor.video_url).trim() : editor.video_url.trim(),
        video_id: editor.provider === "cloudflare" ? editor.playback_id : externalIdFor(editor.provider, editor.video_url),
        thumbnail_url: editor.thumbnail_url.trim() || null,
        category_id: editor.category_id,
        playback_id: editor.provider === "cloudflare" ? editor.playback_id : null,
        processing_status: editor.processing_status || "ready",
        is_featured: Boolean(editor.is_featured),
        is_visible: true,
        display_order: Number(editor.display_order),
      };
      const result = editor.id
        ? await supabase.from("videos").update(payload).eq("id", editor.id).select(VIDEO_COLUMNS).single()
        : await supabase.from("videos").insert(payload).select(VIDEO_COLUMNS).single();
      if (result.error) throw result.error;
      if (editor.draftId) {
        const { error: draftError } = await supabase.from("video_drafts").delete().eq("id", editor.draftId);
        if (draftError) throw draftError;
      }
      setNotice(`“${editor.title.trim()}” is now published.`);
      setEditor(null);
      await loadData();
    } catch (publishError) {
      setError(getErrorMessage(publishError, "publish this video"));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleVisibility(item) {
    if (!item.id) return;
    const next = !item.is_visible;
    if (next && item.provider === "cloudflare" && item.processing_status !== "ready") return setError("Cloudflare is still processing this video. It can only be published after it is ready.");
    if (next && !window.confirm(`Publish “${item.title}” in ${item.categoryTitle}?`)) return;
    setError("");
    const { error: updateError } = await supabase.from("videos").update({ is_visible: next }).eq("id", item.id);
    if (updateError) return setError(getErrorMessage(updateError, "change publishing status"));
    setNotice(next ? `“${item.title}” published.` : `“${item.title}” hidden from public pages.`);
    await loadData();
  }

  async function deleteVideo(item) {
    if (!window.confirm(item.id
      ? `Delete “${item.title}” from the portfolio? This removes the published record and any saved draft. The original JSON fallback remains available until the migration is confirmed.`
      : `Delete the draft “${item.title}”?`)) return;
    setError("");
    try {
      if (item.id) {
        const { error: deleteError } = await supabase.from("videos").delete().eq("id", item.id);
        if (deleteError) throw deleteError;
      } else if (item.draftId) {
        const { error: deleteError } = await supabase.from("video_drafts").delete().eq("id", item.draftId);
        if (deleteError) throw deleteError;
      }
      setNotice(`“${item.title}” deleted.`);
      await loadData();
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "delete this video"));
    }
  }

  async function uploadCloudflare() {
    if (!uploadFile) return setError("Choose an MP4, MOV, or WebM file first.");
    if (!/\.(mp4|mov|webm)$/i.test(uploadFile.name)) return setError("Choose an MP4, MOV, or WebM video.");
    const expectedType = /\.mp4$/i.test(uploadFile.name) ? "video/mp4" : /\.mov$/i.test(uploadFile.name) ? "video/quicktime" : "video/webm";
    if (uploadFile.type && uploadFile.type.toLowerCase() !== expectedType) return setError("The selected video type does not match its file extension.");
    if (uploadFile.size > MAX_UPLOAD_BYTES) return setError("Cloudflare Stream uploads must be smaller than 30 GB.");
    if (!editor.title.trim()) return setError("Add a video title before uploading to Cloudflare.");
    if (!editor.category_id) return setError("Choose a category before uploading to Cloudflare.");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.access_token) return setError("Your admin session has expired. Sign in again before uploading.");
    setIsUploading(true);
    setUploadProgress(0);
    setError("");
    try {
      const endpointResponse = await fetch("/api/cloudflare/direct-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ fileSize: uploadFile.size, fileName: uploadFile.name, fileType: expectedType }),
      });
      const endpointData = await endpointResponse.json().catch(() => ({}));
      if (!endpointResponse.ok) throw new Error(endpointData.error || "Cloudflare upload setup is unavailable. Check the server environment variables and deploy to Vercel.");
      if (endpointData.protocol === "tus") {
        await uploadWithTus(endpointData.uploadUrl, uploadFile, (loaded, total) => setUploadProgress(Math.round((loaded / total) * 100)));
      } else {
        const formData = new FormData();
        formData.append("file", uploadFile, uploadFile.name);
        await xhrRequest({ url: endpointData.uploadUrl, method: "POST", body: formData, onProgress: (loaded, total) => setUploadProgress(Math.round((loaded / total) * 100)) });
      }
      const customerCode = import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE;
      const poster = customerCode ? `https://customer-${customerCode}.cloudflarestream.com/${endpointData.uid}/thumbnails/thumbnail.jpg` : "";
      const uploadedForm = { ...editor, provider: "cloudflare", video_url: endpointData.uid, video_id: endpointData.uid, playback_id: endpointData.uid, thumbnail_url: editor.thumbnail_url || poster, processing_status: "processing" };
      setEditor(uploadedForm);
      const draftPayload = buildDraftPayload(uploadedForm);
      const draftResult = uploadedForm.draftId
        ? await supabase.from("video_drafts").update(draftPayload).eq("id", uploadedForm.draftId).select(DRAFT_COLUMNS).single()
        : await supabase.from("video_drafts").insert(draftPayload).select(DRAFT_COLUMNS).single();
      if (draftResult.error) throw new Error(`Upload succeeded (Stream UID ${endpointData.uid}), but saving its private draft failed: ${getErrorMessage(draftResult.error, "save the uploaded draft")}`);
      const savedForm = mapDraftToForm(draftResult.data, categories.find((category) => category.id === editor.category_id)?.title);
      savedForm.id = editor.id || null;
      savedForm.video_id = endpointData.uid;
      savedForm.draftId = draftResult.data.id;
      setEditor(savedForm);
      setEditorBaseline(JSON.stringify(savedForm));
      setNotice("Private draft saved. Cloudflare is processing the video; check status before publishing.");
      await loadData();
    } catch (uploadError) {
      setError(uploadError.message || "Cloudflare upload failed. The video was not saved.");
    } finally {
      setIsUploading(false);
    }
  }

  async function checkCloudflareStatus() {
    const uid = editor?.playback_id || editor?.video_url;
    if (!/^[a-f\d]{16,64}$/i.test(uid || "")) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session?.access_token) return setError("Your admin session has expired. Sign in again.");
    setIsCheckingCloudflare(true);
    try {
      const response = await fetch("/api/cloudflare/status", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` }, body: JSON.stringify({ uid }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not read the Cloudflare processing status.");
      const status = result.readyToStream ? "ready" : result.state === "error" ? "failed" : "processing";
      setEditor((current) => ({ ...current, processing_status: status, thumbnail_url: current.thumbnail_url || result.thumbnail || "" }));
      setEditorBaseline("");
      setNotice(status === "ready" ? "Cloudflare reports this video is ready to play." : status === "failed" ? "Cloudflare reported a processing error. Upload the source file again." : "Cloudflare is still processing this video.");
    } catch (statusError) {
      setError(statusError.message || "Could not read the Cloudflare processing status.");
    } finally {
      setIsCheckingCloudflare(false);
    }
  }

  function closeEditor() {
    if (JSON.stringify(editor) !== editorBaseline && !window.confirm("Discard unsaved video changes?")) return;
    setEditor(null);
    setError("");
  }

  const editorPreview = editor && editor.video_url && !validateVideo(editor)
    ? { title: editor.title || "Video preview", url: editor.provider === "cloudflare" ? "" : editor.video_url, provider: editor.provider, thumbnail: editor.thumbnail_url, playbackId: editor.playback_id, videoId: editor.video_id }
    : null;

  return (
    <section className="admin-video-manager" aria-labelledby="admin-video-manager-title">
      <header className="admin-page-heading"><div><p className="admin-page-heading__eyebrow">PORTFOLIO CONTENT / VIDEO LIBRARY</p><h1 id="admin-video-manager-title">Video <em>Manager.</em></h1><p className="admin-home-intro">Manage public work videos across every category. Draft edits stay private until you publish them.</p></div><span className="admin-page-heading__folio">04 — 09</span></header>
      {error && <div className="admin-alert admin-alert--dashboard" role="alert">{error}</div>}
      {notice && <p className="admin-video-notice" role="status">{notice}</p>}
      <div className="admin-video-toolbar">
        <label className="admin-home-field"><span>Search titles</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search videos…" /></label>
        <label className="admin-home-field"><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}{category.is_visible ? "" : " · Hidden"}</option>)}</select></label>
        <label className="admin-home-field"><span>Provider</span><select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}><option value="all">All providers</option>{PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
        <label className="admin-home-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="hidden">Hidden</option><option value="draft">Draft</option><option value="draft-changes">Draft changes</option></select></label>
        <button className="admin-category-save admin-video-add" type="button" onClick={() => openEditor()} disabled={!categories.length}>+ ADD VIDEO</button>
      </div>
      <p className="admin-video-count">{visibleItems.length} {visibleItems.length === 1 ? "VIDEO" : "VIDEOS"} <span>·</span> {videos.length} published records and {drafts.length} drafts</p>
      {isLoading ? <div className="admin-media-state" role="status"><span className="admin-media-spinner" />Loading videos and categories…</div>
        : !categories.length ? <div className="admin-media-state admin-media-state--error"><strong>No categories found</strong><p>Apply the Phase 6 category migration, followed by the Phase 7 Video Manager migration.</p></div>
        : !visibleItems.length ? <div className="admin-media-state"><span>VIDEO MANAGER</span><strong>{listing.length ? "No matching videos" : "No video records yet"}</strong><p>{listing.length ? "Change or clear the filters to see other videos." : "Apply the Phase 7 migration to import the existing video library safely."}</p></div>
        : <div className="admin-video-grid">{visibleItems.map((item, index) => {
          const provider = item.draftData?.provider || item.provider;
          const thumb = item.displayThumbnail || (provider === "youtube" ? `https://i.ytimg.com/vi/${externalIdFor("youtube", item.draftData?.video_url || item.video_url)}/hqdefault.jpg` : "");
          const category = categories.find((entry) => entry.id === item.category_id);
          const published = item.entryType !== "draft-only" && item.is_visible;
          const status = item.entryType === "draft-only" ? "Draft" : item.draftId ? (published ? "Published · draft changes" : "Hidden · draft changes") : published ? "Published" : "Hidden";
          return <article className="admin-video-card" key={item.id || `draft-${item.draftId}`}>
            <div className="admin-video-card__poster">{thumb ? <img src={thumb} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /> : <div><span>{providerLabel(provider).toUpperCase()}</span><strong>{item.displayTitle}</strong></div>}<span className={`admin-video-card__status${published ? " is-published" : ""}`}>{status}</span><span className="admin-video-card__order">/{String(item.display_order || index + 1).padStart(2, "0")}</span></div>
            <div className="admin-video-card__body"><div className="admin-video-card__title"><h2>{item.displayTitle}</h2><span>{providerLabel(provider)}</span></div><p>{category?.title || "Category unavailable"}</p>{provider === "cloudflare" && <p className="admin-video-card__processing">Stream · {item.processing_status || "processing"}</p>}
              <div className="admin-video-card__actions"><button type="button" onClick={() => openEditor(item)}>EDIT</button>{item.id && <button type="button" onClick={() => void toggleVisibility(item)}>{published ? "HIDE" : "PUBLISH"}</button>}<button className="is-danger" type="button" onClick={() => void deleteVideo(item)}>DELETE</button></div>
            </div>
          </article>;
        })}</div>}

      {editor && <div className="admin-video-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving && !isUploading) closeEditor(); }}>
        <section className="admin-video-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-video-dialog-title">
          <header className="admin-video-dialog__header"><div><p className="admin-page-heading__eyebrow">{editor.id ? "EDIT VIDEO / PRIVATE DRAFT" : "NEW PORTFOLIO VIDEO"}</p><h2 id="admin-video-dialog-title">{editor.title || "Video details"}</h2><p>Changes stay private until you choose Publish.</p></div><button type="button" onClick={closeEditor} disabled={isSaving || isUploading} aria-label="Close editor">×</button></header>
          {error && <div className="admin-alert" role="alert">{error}</div>}
          {notice && <p className="admin-video-notice" role="status">{notice}</p>}
          <div className="admin-video-form">
            <label className="admin-home-field"><span>Video title</span><input value={editor.title} onChange={(event) => updateEditor("title", event.target.value)} maxLength={180} placeholder="Name this video" /></label>
            <label className="admin-home-field"><span>Description <small>· OPTIONAL</small></span><textarea rows={3} value={editor.description} onChange={(event) => updateEditor("description", event.target.value)} maxLength={1000} placeholder="A short description" /></label>
            <div className="admin-video-form__two-col">
              <label className="admin-home-field"><span>Category</span><select value={editor.category_id} onChange={(event) => updateEditor("category_id", event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
              <label className="admin-home-field"><span>Provider</span><select value={editor.provider} onChange={(event) => { updateEditor("provider", event.target.value); if (event.target.value !== editor.provider) { setEditor((current) => ({ ...current, provider: event.target.value, video_url: "", video_id: "", playback_id: "", processing_status: "ready" })); setUploadFile(null); } }}>{PROVIDERS.map((provider) => <option key={provider.id} value={provider.id}>{provider.label}</option>)}</select></label>
            </div>
            {editor.provider === "cloudflare" ? <div className="admin-video-upload-box">
              <p>Choose an MP4, MOV, or WebM file. The browser sends it directly to Cloudflare; Vercel only creates a one-time upload link.</p>
              {!editor.playback_id && <div className="admin-video-file-drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files?.[0]; if (file) setUploadFile(file); }}><label className="admin-home-field"><span>Drop a video here or browse</span><input type="file" accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm" onChange={(event) => { setUploadFile(event.target.files?.[0] || null); event.target.value = ""; }} /></label><small>MP4, MOV, or WebM · upload goes directly to Cloudflare Stream.</small></div>}
              {uploadFile && <p className="admin-video-upload-box__filename">{uploadFile.name} · {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB</p>}
              {editor.playback_id && <p className="admin-video-upload-box__filename">Cloudflare Stream UID: {editor.playback_id} · Status: <strong>{editor.processing_status}</strong></p>}
              {isUploading && <div className="admin-video-progress" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${uploadProgress}%` }} /></div>}
              <div className="admin-video-upload-box__actions">{!editor.playback_id && <button type="button" onClick={() => void uploadCloudflare()} disabled={isUploading || !uploadFile}>{isUploading ? `UPLOADING ${uploadProgress}%` : "UPLOAD TO CLOUDFLARE"}</button>}{editor.playback_id && <><button type="button" onClick={() => void checkCloudflareStatus()} disabled={isCheckingCloudflare}>{isCheckingCloudflare ? "CHECKING…" : "CHECK PROCESSING STATUS"}</button><button type="button" onClick={() => { setEditor((current) => ({ ...current, video_url: "", video_id: "", playback_id: "", processing_status: "ready" })); setUploadFile(null); }}>REPLACE VIDEO FILE</button></>}</div>
              <small>Cloudflare uploads above 200 MB use resumable TUS chunks. The Cloudflare server credentials must be configured in Vercel.</small>
            </div> : <label className="admin-home-field"><span>{editor.provider === "direct" ? "Direct MP4 / WebM URL" : "Video URL"}</span><input type="url" inputMode="url" value={editor.video_url} onChange={(event) => updateEditor("video_url", event.target.value)} placeholder={editor.provider === "youtube" ? "https://youtu.be/…" : editor.provider === "vimeo" ? "https://vimeo.com/…" : editor.provider === "google_drive" ? "https://drive.google.com/file/d/…" : "https://example.com/video.mp4"} />{editor.provider === "google_drive" && <small className="admin-video-help">Google Drive files need viewer access for the people visiting your portfolio. Sharing links are kept as supplied.</small>}{editor.provider === "vimeo" && <small className="admin-video-help">Unlisted Vimeo hashes and query parameters stay in the saved URL.</small>}</label>}
            <div className="admin-video-form__two-col">
              <MediaUploadField label="Video thumbnail" bucket="thumbnails" value={editor.thumbnail_url} disabled={isSaving || isUploading} onChange={({ url }) => updateEditor("thumbnail_url", url)} />
              <label className="admin-home-field"><span>Display order</span><input type="number" min="1" step="1" value={editor.display_order} onChange={(event) => updateEditor("display_order", Number(event.target.value))} /><span className="admin-video-toggle"><input type="checkbox" checked={editor.is_featured} onChange={(event) => updateEditor("is_featured", event.target.checked)} /> Feature this video</span></label>
            </div>
            {editorPreview && <div className="admin-video-preview"><span>CLICK TO PREVIEW</span><FeaturedVideoCard video={editorPreview} /></div>}
          </div>
          <footer className="admin-video-dialog__actions"><span>{editor.id ? "Published video data remains live while you save a draft." : "This new video is private until published."}</span><div><button type="button" onClick={closeEditor} disabled={isSaving || isUploading}>CANCEL</button><button type="button" onClick={() => void saveDraft()} disabled={isSaving || isUploading}>{isSaving ? "SAVING…" : "SAVE DRAFT"}</button><button className="is-publish" type="button" onClick={() => void publishVideo()} disabled={isSaving || isUploading}>{isSaving ? "SAVING…" : "PUBLISH"}</button></div></footer>
        </section>
      </div>}
    </section>
  );
}
