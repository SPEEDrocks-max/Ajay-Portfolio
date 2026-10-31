import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const PAGE_SIZE = 24;
const IMAGE_TYPES = {
  jpg: { mime: "image/jpeg", label: "JPEG image" },
  jpeg: { mime: "image/jpeg", label: "JPEG image" },
  png: { mime: "image/png", label: "PNG image" },
  webp: { mime: "image/webp", label: "WebP image" },
  avif: { mime: "image/avif", label: "AVIF image" },
};
const FONT_TYPES = {
  woff: { mime: "font/woff", label: "WOFF font" },
  woff2: { mime: "font/woff2", label: "WOFF2 font" },
  ttf: { mime: "font/ttf", label: "TrueType font" },
  otf: { mime: "font/otf", label: "OpenType font" },
};
const BUCKETS = [
  { id: "thumbnails", label: "Thumbnails", kind: "images", maxBytes: 5 * 1024 * 1024, maxLabel: "5 MB" },
  { id: "images", label: "Images", kind: "images", maxBytes: 10 * 1024 * 1024, maxLabel: "10 MB" },
  { id: "logos", label: "Logos", kind: "images", maxBytes: 2 * 1024 * 1024, maxLabel: "2 MB" },
  { id: "backgrounds", label: "Backgrounds", kind: "images", maxBytes: 20 * 1024 * 1024, maxLabel: "20 MB" },
  { id: "fonts", label: "Fonts", kind: "fonts", maxBytes: 10 * 1024 * 1024, maxLabel: "10 MB" },
];

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function getExtension(fileName = "") {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function getErrorMessage(error, action) {
  const status = Number(error?.statusCode || error?.status);
  if (status === 401 || status === 403) {
    return `Storage denied the ${action}. Your admin session may have expired, or the Storage policies may need to be applied.`;
  }
  if (/bucket.*not found/i.test(error?.message || "")) {
    return "This Storage bucket could not be found. Confirm that the existing portfolio buckets are set up in Supabase.";
  }
  return error?.message || `Could not ${action}. Please try again.`;
}

function sanitizeFileName(fileName) {
  return fileName.normalize("NFKC").replace(/[\\/]/g, "-").replace(/[^\p{L}\p{N}._ -]/gu, "-").replace(/\s+/g, "-").replace(/-+/g, "-").slice(-140) || "asset";
}

function AssetPreview({ asset, bucket }) {
  const [failed, setFailed] = useState(false);
  const [useOriginal, setUseOriginal] = useState(false);
  const storage = supabase.storage.from(bucket);
  const originalUrl = storage.getPublicUrl(asset.name).data.publicUrl;
  const previewUrl = storage.getPublicUrl(asset.name, {
    transform: { width: 560, quality: 70, resize: "contain" },
  }).data.publicUrl;

  if (bucket === "fonts") {
    const extension = getExtension(asset.metadata?.originalName || asset.name).toUpperCase();
    return <div className="admin-media-font-preview" aria-label={`${extension} font file`}><span>TYPE</span><strong>{extension || "FONT"}</strong><i>Aa</i></div>;
  }

  if (failed) return <div className="admin-media-file-preview"><span>IMAGE</span><strong>Preview unavailable</strong></div>;
  return (
    <img
      src={useOriginal ? originalUrl : previewUrl}
      alt={asset.metadata?.originalName || asset.name}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (!useOriginal && previewUrl !== originalUrl) setUseOriginal(true);
        else setFailed(true);
      }}
    />
  );
}

function AssetCard({ asset, bucket, onCopy, onDelete, picker, onSelect }) {
  const originalName = asset.metadata?.originalName || asset.name.split("/").pop();
  const type = asset.metadata?.mimetype || IMAGE_TYPES[getExtension(originalName)]?.mime || FONT_TYPES[getExtension(originalName)]?.mime || "Unknown file type";
  const storagePath = `${bucket}/${asset.name}`;
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(asset.name).data.publicUrl;

  return (
    <article className="admin-media-card">
      <div className="admin-media-card__preview"><AssetPreview asset={asset} bucket={bucket} /></div>
      <div className="admin-media-card__details">
        <h2 title={originalName}>{originalName}</h2>
        <p>{type} <span aria-hidden="true">·</span> {formatBytes(asset.metadata?.size)}</p>
        <p>Uploaded {formatDate(asset.created_at || asset.updated_at)}</p>
        {picker ? (
          <div className="admin-media-card__actions"><button className="admin-media-card__select" type="button" onClick={() => onSelect({ ...asset, bucket, publicUrl, storagePath })}>{bucket === "fonts" ? "USE THIS FONT" : "USE THIS IMAGE"}</button></div>
        ) : (
          <div className="admin-media-card__actions">
            <button type="button" onClick={() => onCopy(publicUrl, "Public URL copied")}>COPY URL</button>
            <button type="button" onClick={() => onCopy(storagePath, "Storage path copied")}>COPY PATH</button>
            <button className="is-danger" type="button" onClick={() => onDelete(asset)}>DELETE</button>
          </div>
        )}
      </div>
    </article>
  );
}

export default function MediaLibrary({ picker = false, pickerKind = "images", onSelect, onClose }) {
  const initialBucket = pickerKind === "fonts" ? "fonts" : "images";
  const [bucket, setBucket] = useState(picker ? initialBucket : BUCKETS[0].id);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef(null);
  const requestIdRef = useRef(0);
  const availableBuckets = useMemo(() => picker ? BUCKETS.filter((item) => item.kind === pickerKind) : BUCKETS, [picker, pickerKind]);
  const selectedBucket = useMemo(() => availableBuckets.find((item) => item.id === bucket) || availableBuckets[0], [availableBuckets, bucket]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAssets([]);
      setOffset(0);
      setHasMore(false);
      setSearch(searchInput.trim());
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput, bucket]);

  const loadAssets = useCallback(async (nextOffset, append) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError("");
    try {
      const { data, error: listError } = await supabase.storage.from(bucket).list("", {
        limit: PAGE_SIZE + 1,
        offset: nextOffset,
        sortBy: { column: "created_at", order: "desc" },
        ...(search ? { search } : {}),
      });
      if (listError) throw listError;
      if (requestId !== requestIdRef.current) return;
      const entries = (data || []).filter((entry) => entry.id && entry.metadata);
      const page = entries.slice(0, PAGE_SIZE);
      setAssets((current) => append ? [...current, ...page] : page);
      setHasMore((data || []).length > PAGE_SIZE);
      setOffset(nextOffset);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(getErrorMessage(loadError, "load assets"));
      if (!append) setAssets([]);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [bucket, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadAssets(0, false); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadAssets]);

  async function copyValue(value, successMessage) {
    setError("");
    setNotice("");
    try {
      await navigator.clipboard.writeText(value);
      setNotice(successMessage);
    } catch {
      setError("Could not access the clipboard. Check browser clipboard permissions and try again.");
    }
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setNotice("");

    const extension = getExtension(file.name);
    const allowedTypes = selectedBucket.kind === "fonts" ? FONT_TYPES : IMAGE_TYPES;
    const typeInfo = allowedTypes[extension];
    if (!typeInfo || file.type.startsWith("video/")) {
      setError(selectedBucket.kind === "fonts"
        ? "Choose a WOFF, WOFF2, TTF, or OTF font file."
        : "Choose a JPG, JPEG, PNG, WebP, or AVIF image file. Videos are not supported.");
      return;
    }
    const suppliedType = file.type.toLowerCase();
    if (suppliedType && suppliedType !== typeInfo.mime && !(selectedBucket.kind === "fonts" && suppliedType === "application/octet-stream")) {
      setError(`The selected file's type does not match its .${extension} extension.`);
      return;
    }
    if (file.size === 0 || file.size > selectedBucket.maxBytes) {
      setError(`This file must be smaller than ${selectedBucket.maxLabel} and cannot be empty.`);
      return;
    }

    const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    setIsUploading(true);
    try {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(uniqueName, file, {
        cacheControl: "3600",
        contentType: typeInfo.mime,
        upsert: false,
        metadata: { originalName: file.name },
      });
      if (uploadError) throw uploadError;
      setNotice(`${file.name} uploaded to ${selectedBucket.label}.`);
      await loadAssets(0, false);
    } catch (uploadError) {
      setError(getErrorMessage(uploadError, "upload this file"));
    } finally {
      setIsUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deletingAsset) return;
    const { asset, bucket: assetBucket } = deletingAsset;
    setIsDeleting(true);
    setError("");
    setNotice("");
    try {
      const { error: deleteError } = await supabase.storage.from(assetBucket).remove([asset.name]);
      if (deleteError) throw deleteError;
      setDeletingAsset(null);
      setNotice(`${asset.metadata?.originalName || asset.name} deleted.`);
      if (assetBucket === bucket) await loadAssets(0, false);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "delete this asset"));
    } finally {
      setIsDeleting(false);
    }
  }

  function loadMore() {
    if (!isLoading && hasMore) void loadAssets(offset + PAGE_SIZE, true);
  }

  return (
    <section className={`admin-media${picker ? " admin-media--picker" : ""}`} aria-labelledby="admin-media-title">
      <div className="admin-page-heading admin-media__heading">
        <div>
          <p className="admin-page-heading__eyebrow">{picker ? "SELECT AN IMAGE / MEDIA LIBRARY" : "ASSET MANAGEMENT / STORAGE"}</p>
          <h1 id="admin-media-title">{picker ? pickerKind === "fonts" ? <>Choose a <em>font.</em></> : <>Choose an <em>image.</em></> : <>Media <em>Library.</em></>}</h1>
          <p className="admin-media__description">{picker ? pickerKind === "fonts" ? "Choose an existing font file from the Media Library." : "Choose an existing image asset from the Media Library." : "Browse and manage the images and type assets used across the portfolio."}</p>
        </div>
        {picker ? <button className="admin-home-picker__close" type="button" onClick={onClose}>CLOSE <span aria-hidden="true">×</span></button> : <span className="admin-page-heading__folio">05 — 09</span>}
      </div>

      <div className="admin-media-toolbar">
        <label className="admin-media-select">CATEGORY
          <select value={bucket} disabled={isUploading} onChange={(event) => { setBucket(event.target.value); setSearchInput(""); setSearch(""); }}>
            {availableBuckets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="admin-media-search"><span>SEARCH FILES</span>
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by filename" type="search" />
        </label>
        {!picker && <button className="admin-media-upload" type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? <><i aria-hidden="true" /> UPLOADING…</> : <>UPLOAD ASSET <span aria-hidden="true">↗</span></>}
        </button>}
        {!picker && <input ref={fileInputRef} className="admin-media-file-input" type="file" accept={selectedBucket.kind === "fonts" ? ".woff,.woff2,.ttf,.otf" : ".jpg,.jpeg,.png,.webp,.avif"} onChange={handleFileSelection} />}
      </div>
      <p className="admin-media__bucket-note">/{bucket} <span>·</span> {selectedBucket.kind === "fonts" ? "WOFF, WOFF2, TTF, OTF" : "JPG, PNG, WebP, AVIF"} <span>·</span> Max {selectedBucket.maxLabel}</p>

      {isUploading && <div className="admin-media-progress" role="status"><span /><span className="admin-media-sr-only">Upload in progress</span></div>}
      {notice && <p className="admin-media-message admin-media-message--success" role="status">{notice}</p>}
      {error && <p className="admin-alert admin-media-message" role="alert">{error}</p>}

      {isLoading && assets.length === 0 ? (
        <div className="admin-media-state" role="status"><span className="admin-media-spinner" /> Loading assets…</div>
      ) : error && assets.length === 0 ? (
        <div className="admin-media-state admin-media-state--error">Assets could not be loaded. Check your connection and Storage policies.</div>
      ) : assets.length === 0 ? (
        <div className="admin-media-state"><span>EMPTY / {bucket.toUpperCase()}</span><strong>{search ? "No matching assets" : "No assets in this bucket yet"}</strong><p>{search ? "Try another filename." : picker ? "Upload images in the Media Library first, then choose them here." : "Upload an image or font to get started."}</p></div>
      ) : (
        <>
          <div className="admin-media-grid">
            {assets.map((asset) => <AssetCard key={`${bucket}/${asset.name}`} asset={asset} bucket={bucket} onCopy={copyValue} onDelete={(selectedAsset) => setDeletingAsset({ asset: selectedAsset, bucket })} picker={picker} onSelect={onSelect} />)}
          </div>
          {hasMore && <div className="admin-media-load-more"><button type="button" onClick={loadMore} disabled={isLoading}>{isLoading ? "LOADING…" : "LOAD MORE ASSETS"}</button></div>}
        </>
      )}

      {!picker && deletingAsset && (
        <div className="admin-media-dialog-backdrop">
          <section className="admin-media-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-media-delete-title" aria-describedby="admin-media-delete-warning">
            <p className="admin-page-heading__eyebrow">CONFIRM DELETION</p>
            <h2 id="admin-media-delete-title">Delete this asset?</h2>
            <p className="admin-media-dialog__file">{deletingAsset.asset.metadata?.originalName || deletingAsset.asset.name}</p>
            <p id="admin-media-delete-warning">Deleting this asset may break any website section currently using it. This action cannot be undone.</p>
            <div><button type="button" onClick={() => setDeletingAsset(null)} disabled={isDeleting}>CANCEL</button><button className="is-danger" type="button" onClick={confirmDelete} disabled={isDeleting}>{isDeleting ? "DELETING…" : "DELETE ASSET"}</button></div>
          </section>
        </div>
      )}
    </section>
  );
}
