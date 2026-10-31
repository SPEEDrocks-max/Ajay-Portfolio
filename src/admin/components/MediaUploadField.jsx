import { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

const IMAGE_TYPES = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif",
};
const BUCKET_LIMITS = { thumbnails: 5, images: 10, logos: 2, backgrounds: 20 };
const ACCEPT = ".jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif";
const safeName = (name) => name.normalize("NFKC").replace(/[\\/]/g, "-").replace(/[^\p{L}\p{N}._-]/gu, "-").slice(-120) || "image";

export default function MediaUploadField({ label, value = "", bucket = "images", onChange, disabled = false }) {
  const inputRef = useRef(null);
  const busyRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload(file) {
    if (!file || busyRef.current || disabled) return;
    setMessage(""); setError("");
    const extension = file.name.split(".").pop()?.toLowerCase();
    const mime = IMAGE_TYPES[extension];
    const maxBytes = (BUCKET_LIMITS[bucket] || BUCKET_LIMITS.images) * 1024 * 1024;
    if (!mime || (file.type && file.type.toLowerCase() !== mime)) {
      setError("Choose a JPG, PNG, WebP, or AVIF image."); return;
    }
    if (!file.size || file.size > maxBytes) {
      setError(`Choose an image smaller than ${BUCKET_LIMITS[bucket] || BUCKET_LIMITS.images} MB.`); return;
    }
    if (!supabase) { setError("Image upload is unavailable because Supabase is not configured."); return; }
    busyRef.current = true;
    setBusy(true);
    try {
      const path = `${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
      const { data, error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600", contentType: mime, upsert: false, metadata: { originalName: file.name },
      });
      if (uploadError) throw uploadError;
      const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(data.path);
      if (!publicData?.publicUrl) throw new Error("Storage did not return a public image URL.");
      onChange({ url: publicData.publicUrl, path: data.path, bucket });
      setMessage("Uploaded and attached. Save changes to store it with this content.");
    } catch (uploadError) {
      setError(uploadError?.statusCode === 401 || uploadError?.statusCode === 403
        ? "Upload denied. Sign in as an authorized admin or ask the site owner to check Storage access."
        : uploadError?.message || "Image upload failed. Please retry.");
    } finally {
      window.setTimeout(() => { busyRef.current = false; setBusy(false); }, 350);
    }
  }

  const chooseFile = (file) => { if (file) void upload(file); };
  const preview = value;
  return (
    <div className="admin-upload-field">
      <span className="admin-upload-field__label">{label}</span>
      {preview ? <div className="admin-upload-field__preview"><img src={preview} alt={`${label} preview`} loading="lazy" decoding="async" /><button type="button" onClick={() => { onChange({ url: "", path: "", bucket }); setMessage(""); setError(""); }} disabled={busy || disabled}>REMOVE</button></div> : null}
      <button className={`admin-upload-drop${dragging ? " is-dragging" : ""}`} type="button" disabled={busy || disabled} onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); if (!busy && !disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}>
        <strong>{busy ? "Uploading image…" : value ? "Replace image" : "Add image"}</strong>
        <span>Drop an image here or click to browse · JPG, PNG, WebP, AVIF · up to {BUCKET_LIMITS[bucket] || BUCKET_LIMITS.images} MB</span>
      </button>
      <input ref={inputRef} className="admin-upload-input" type="file" accept={ACCEPT} disabled={busy || disabled} onChange={(event) => { chooseFile(event.target.files?.[0]); event.target.value = ""; }} />
      {busy && <div className="admin-upload-progress" role="progressbar" aria-label="Uploading image"><span /></div>}
      {message && <p className="admin-upload-message" role="status">{message}</p>}{error && <p className="admin-upload-error" role="alert">{error}</p>}
    </div>
  );
}
