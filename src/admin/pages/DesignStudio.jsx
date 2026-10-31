import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { loadPublishedCategories } from "../../lib/categories";
import { DEFAULT_PAGE_DESIGN, normalizePageDesign } from "../../lib/pageDesign";
import MediaLibrary from "./MediaLibrary";
import MediaUploadField from "../components/MediaUploadField";

const ROUTED_PROFILES = [
  { key: "home", label: "Home", path: "/", sections: [["hero", "Intro / hero"], ["company-logos", "Worked with"], ["featured-work", "Featured work"]] },
  { key: "about", label: "About", path: "/about", sections: [["experience", "Experience"], ["tools", "Tools & specializations"]] },
  { key: "work", label: "Work", path: "/work", sections: [["header", "Work introduction"], ["categories", "Category cards"], ["footer", "Footer"]] },
  { key: "category-detail", label: "Category detail default", path: "", sections: [["header", "Category introduction"], ["videos", "Video grid"], ["footer", "Footer"]] },
  { key: "contact", label: "Contact", path: "/contact", sections: [["header", "Contact header"], ["contact", "Contact content"], ["footer", "Footer"]] },
];
const FONT_FIELDS = [["headingFont", "Heading font"], ["bodyFont", "Body font"], ["accentFont", "Accent font"]];
const TYPE_FIELDS = [
  ["heroSize", "Hero title size", 16, 180], ["pageTitleSize", "Page title size", 16, 160], ["sectionTitleSize", "Section heading size", 12, 100],
  ["subheadingSize", "Subheading size", 10, 80], ["bodySize", "Body size", 8, 40], ["navSize", "Navigation size", 8, 32], ["buttonSize", "Button text size", 8, 32],
];
const COLOR_FIELDS = [["text", "Text"], ["muted", "Secondary text"], ["accent", "Accent"], ["background", "Background"], ["surface", "Secondary background"], ["button", "Button"], ["buttonText", "Button text"], ["link", "Link"], ["border", "Border"]];

function errorText(error) {
  if (error?.code === "42P01" || /page_design/i.test(error?.message || "")) return "Design Studio tables are missing. Apply the Phase 8 page design migration in the Supabase SQL Editor.";
  if (error?.code === "42501" || error?.status === 401 || error?.status === 403) return "Supabase denied this action. Confirm your admin session and the page design RLS policies.";
  return error?.message || "Could not save the page design. Please retry.";
}

export default function DesignStudio() {
  const [categories, setCategories] = useState([]);
  const [targetKey, setTargetKey] = useState("home");
  const [design, setDesign] = useState(() => normalizePageDesign({}));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [picker, setPicker] = useState(null);
  const [previewMode, setPreviewMode] = useState("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [savedState, setSavedState] = useState("Published settings loaded");

  const specificCategory = targetKey.startsWith("category:");
  const activeProfile = useMemo(() => {
    if (specificCategory) {
      const slug = targetKey.slice("category:".length);
      const category = categories.find((item) => item.slug === slug);
      return { key: targetKey, label: `Category override / ${category?.title || slug}`, path: `/work/${slug}`, sections: ROUTED_PROFILES[3].sections };
    }
    return ROUTED_PROFILES.find((item) => item.key === targetKey) || ROUTED_PROFILES[0];
  }, [targetKey, specificCategory, categories]);
  const previewPath = activeProfile.path || (categories[0] ? `/work/${categories[0].slug}` : "/work");
  const previewWidth = previewMode === "mobile" ? 390 : previewMode === "tablet" ? 768 : "100%";

  useEffect(() => {
    let active = true;
    loadPublishedCategories().then((items) => { if (active) setCategories(items); });
    return () => { active = false; };
  }, []);

  const loadProfile = useCallback(async (key) => {
    setLoading(true); setError(""); setMessage("");
    try {
      if (!supabase) throw new Error("Supabase is not configured for this project.");
      const [{ data: published, error: publishedError }, { data: draft, error: draftError }] = await Promise.all([
        supabase.from("page_designs").select("design,is_published").eq("target_key", key).maybeSingle(),
        supabase.from("page_design_drafts").select("design,updated_at").eq("target_key", key).maybeSingle(),
      ]);
      if (publishedError) throw publishedError;
      if (draftError) throw draftError;
      setDesign(normalizePageDesign(draft?.design || published?.design || {}));
      setSavedState(draft ? `Draft saved ${new Date(draft.updated_at).toLocaleString()}` : published ? "Published design loaded" : "Using original design");
    } catch (loadError) {
      setDesign(normalizePageDesign({}));
      setError(errorText(loadError));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadProfile(targetKey); }, 0);
    return () => window.clearTimeout(timer);
  }, [targetKey, loadProfile]);

  const updateGroup = (group, key, value) => { setSavedState("Unsaved changes"); setDesign((current) => ({ ...current, [group]: { ...current[group], [key]: value } })); };
  const updateSection = (sectionId, key, value) => { setSavedState("Unsaved changes"); setDesign((current) => ({ ...current, sections: { ...current.sections, [sectionId]: { ...current.sections?.[sectionId], [key]: value } } })); };

  async function saveDraft() {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!supabase) throw new Error("Supabase is not configured for this project.");
      const { error: saveError } = await supabase.from("page_design_drafts").upsert({ target_key: targetKey, design }, { onConflict: "target_key" });
      if (saveError) throw saveError;
      setMessage("Draft saved. It is private until you publish it."); setSavedState("Draft saved just now");
    } catch (saveError) { setError(errorText(saveError)); }
    finally { setBusy(false); }
  }

  async function publishDesign() {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!supabase) throw new Error("Supabase is not configured for this project.");
      const { error: publishError } = await supabase.from("page_designs").upsert({ target_key: targetKey, design, is_published: true }, { onConflict: "target_key" });
      if (publishError) throw publishError;
      const { error: deleteError } = await supabase.from("page_design_drafts").delete().eq("target_key", targetKey);
      if (deleteError) throw deleteError;
      setMessage("Design published for this page profile."); setSavedState("Published just now");
    } catch (publishError) { setError(errorText(publishError)); }
    finally { setBusy(false); }
  }

  async function resetDesign() {
    if (!window.confirm(`Reset ${activeProfile.label} to its original design? This removes its published design and saved draft.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (!supabase) throw new Error("Supabase is not configured for this project.");
      const [published, draft] = await Promise.all([
        supabase.from("page_designs").delete().eq("target_key", targetKey),
        supabase.from("page_design_drafts").delete().eq("target_key", targetKey),
      ]);
      if (published.error) throw published.error;
      if (draft.error) throw draft.error;
      setDesign(normalizePageDesign(DEFAULT_PAGE_DESIGN)); setSavedState("Original design restored"); setMessage("This page now uses its original design."); setPreviewKey((key) => key + 1);
    } catch (resetError) { setError(errorText(resetError)); }
    finally { setBusy(false); }
  }

  function previewDesign() {
    try {
      sessionStorage.setItem(`portfolio-studio-preview:${targetKey}`, JSON.stringify(design));
      setPreviewKey((key) => key + 1); setMessage("Preview refreshed with the current unsaved changes."); setError("");
    } catch { setError("Could not prepare the preview in this browser session."); }
  }

  const previewUrl = `${previewPath}?studioPreview=${encodeURIComponent(targetKey)}&studioPreviewVersion=${previewKey}`;
  const chooseFont = (field) => setPicker({ kind: "fonts", field });
  const setFont = (asset) => {
    const fontName = (asset.metadata?.originalName || asset.name.split("/").pop()).replace(/\.(woff2?|ttf|otf)$/i, "");
    updateGroup("typography", picker.field, { name: fontName, url: asset.publicUrl });
    setPicker(null);
  };
  const updateFontDetails = (field, property, value) => {
    const current = design.typography[field];
    const font = current && typeof current === "object" ? current : { name: typeof current === "string" ? current : "", url: "" };
    updateGroup("typography", field, { ...font, [property]: value });
  };

  return (
    <section className="admin-design-studio" aria-labelledby="admin-design-title">
      <div className="admin-page-heading">
        <div><p className="admin-page-heading__eyebrow">PAGE-WISE VISUAL SYSTEM</p><h1 id="admin-design-title">Page <em>Design.</em></h1><p className="admin-design-studio__intro">Tune the look of each page independently. Design publishing never changes page content.</p><Link className="admin-related-page-link" to="/section-builder">Edit page sections <span aria-hidden="true">↗</span></Link></div>
        <span className="admin-page-heading__folio">06 — 09</span>
      </div>

      <div className="admin-design-toolbar">
        <label>PAGE PROFILE
          <select value={targetKey} disabled={busy} onChange={(event) => setTargetKey(event.target.value)}>
            {ROUTED_PROFILES.map((profile) => <option key={profile.key} value={profile.key}>{profile.label}</option>)}
            {categories.map((category) => <option key={category.slug} value={`category:${category.slug}`}>Category override / {category.title}</option>)}
          </select>
        </label>
        <span className="admin-design-status">{savedState}</span>
        <div className="admin-design-actions">
          <button type="button" onClick={saveDraft} disabled={busy || loading}>SAVE DRAFT</button>
          <button type="button" onClick={previewDesign} disabled={loading}>PREVIEW</button>
          <button className="is-primary" type="button" onClick={publishDesign} disabled={busy || loading}>PUBLISH DESIGN</button>
          <button className="is-danger" type="button" onClick={resetDesign} disabled={busy || loading}>RESET TO ORIGINAL</button>
        </div>
      </div>
      {message && <p className="admin-media-message admin-media-message--success" role="status">{message}</p>}
      {error && <p className="admin-alert" role="alert">{error}</p>}
      {loading ? <div className="admin-media-state" role="status">Loading this page profile…</div> : (
        <div className="admin-design-layout">
          <div className="admin-design-controls">
            <section className="admin-design-panel">
              <h2>Typography</h2><p>Choose an uploaded font, or paste a Google Fonts, Adobe Fonts, or other HTTPS stylesheet link with its CSS family name.</p>
              <div className="admin-design-fonts">
                {FONT_FIELDS.map(([field, label]) => <div className="admin-design-font" key={field}><span>{label}</span><strong>{design.typography[field]?.family || design.typography[field]?.name || "Use website default"}</strong><button type="button" onClick={() => chooseFont(field)}>CHOOSE FONT</button>{design.typography[field] && <button className="is-subtle" type="button" onClick={() => updateGroup("typography", field, "")}>USE DEFAULT</button>}</div>)}
              </div>
              <div className="admin-design-field-grid">
                {FONT_FIELDS.flatMap(([field, label]) => {
                  const selected = design.typography[field];
                  const font = selected && typeof selected === "object" ? selected : { name: typeof selected === "string" ? selected : "", url: "", stylesheetUrl: "" };
                  return [
                    <label key={`${field}-family`}>{label} CSS family name<input type="text" value={font.family || font.name || ""} placeholder="e.g. Roboto" onChange={(event) => updateFontDetails(field, "family", event.target.value)} /></label>,
                    <label key={`${field}-stylesheet`}>{label} stylesheet URL<input type="url" value={font.stylesheetUrl || ""} placeholder="https://fonts.googleapis.com/..." onChange={(event) => updateFontDetails(field, "stylesheetUrl", event.target.value)} /></label>,
                  ];
                })}
                {TYPE_FIELDS.map(([field, label, min, max]) => <label key={field}>{label}<input type="number" min={min} max={max} value={design.typography[field]} placeholder="Original" onChange={(event) => updateGroup("typography", field, event.target.value)} /></label>)}
                <label>Heading weight<input type="number" min="100" max="900" step="100" value={design.typography.headingWeight} placeholder="Original" onChange={(event) => updateGroup("typography", "headingWeight", event.target.value)} /></label>
                <label>Body weight<input type="number" min="100" max="900" step="100" value={design.typography.bodyWeight} placeholder="Original" onChange={(event) => updateGroup("typography", "bodyWeight", event.target.value)} /></label>
                <label>Line height<input type="number" min="0.7" max="2.5" step="0.05" value={design.typography.lineHeight} placeholder="Original" onChange={(event) => updateGroup("typography", "lineHeight", event.target.value)} /></label>
                <label>Letter spacing (px)<input type="number" min="-10" max="30" step="0.25" value={design.typography.letterSpacing} placeholder="Original" onChange={(event) => updateGroup("typography", "letterSpacing", event.target.value)} /></label>
              </div>
            </section>

            <section className="admin-design-panel">
              <h2>Color palette</h2><p>Set the role colors used by this page profile.</p>
              <div className="admin-design-colors">{COLOR_FIELDS.map(([field, label]) => <label key={field}><span>{label}</span><input type="color" value={design.colors[field] || "#777777"} onChange={(event) => updateGroup("colors", field, event.target.value)} /><input type="text" value={design.colors[field]} placeholder="Original" onChange={(event) => updateGroup("colors", field, event.target.value)} /></label>)}</div>
            </section>

            <section className="admin-design-panel">
              <h2>Background & surface</h2><p>Upload background and section images directly here.</p>
              <div className="admin-design-field-grid">
                <label>Background style<select value={design.background.mode} onChange={(event) => updateGroup("background", "mode", event.target.value)}><option value="solid">Solid color</option><option value="gradient">Gradient</option><option value="image">Image</option></select></label>
                {design.background.mode === "gradient" ? <><label>Gradient start<input type="color" value={design.background.gradientStart || "#050505"} onChange={(event) => updateGroup("background", "gradientStart", event.target.value)} /></label><label>Gradient end<input type="color" value={design.background.gradientEnd || "#202020"} onChange={(event) => updateGroup("background", "gradientEnd", event.target.value)} /></label></> : null}
                {design.background.mode === "image" ? <><div className="admin-design-wide"><MediaUploadField label="Page background image" bucket="backgrounds" value={design.background.imageUrl} disabled={busy} onChange={({ url }) => updateGroup("background", "imageUrl", url)} /></div><label>Image position<input value={design.background.imagePosition} onChange={(event) => updateGroup("background", "imagePosition", event.target.value)} placeholder="center" /></label><label>Image fit<select value={design.background.imageSize} onChange={(event) => updateGroup("background", "imageSize", event.target.value)}><option value="cover">Cover</option><option value="contain">Contain</option><option value="auto">Original size</option></select></label><label>Overlay color<input type="color" value={design.background.overlayColor || "#000000"} onChange={(event) => updateGroup("background", "overlayColor", event.target.value)} /></label><label>Overlay opacity (%)<input type="number" min="0" max="100" value={design.background.overlay} onChange={(event) => updateGroup("background", "overlay", event.target.value)} /></label></> : null}
                <label>Grain opacity (%)<input type="number" min="0" max="100" value={design.background.grain} placeholder="Keep original" onChange={(event) => updateGroup("background", "grain", event.target.value)} /></label>
                <label>Button style<select value={design.buttons.style} onChange={(event) => updateGroup("buttons", "style", event.target.value)}><option value="">Keep original</option><option value="outline">Outline</option><option value="solid">Solid</option><option value="text">Text only</option></select></label>
                <label>Button radius (px)<input type="number" min="0" max="80" value={design.buttons.radius} placeholder="Keep original" onChange={(event) => updateGroup("buttons", "radius", event.target.value)} /></label>
                <label>Card background<input type="color" value={design.cards.background || design.colors.surface || "#171717"} onChange={(event) => updateGroup("cards", "background", event.target.value)} /></label>
                <label>Card border<input type="color" value={design.cards.border || design.colors.border || "#444444"} onChange={(event) => updateGroup("cards", "border", event.target.value)} /></label>
                <label>Card radius (px)<input type="number" min="0" max="80" value={design.cards.radius} placeholder="Keep original" onChange={(event) => updateGroup("cards", "radius", event.target.value)} /></label>
              </div>
            </section>

            <section className="admin-design-panel">
              <h2>Responsive scale</h2><p>Scale large headings down at smaller viewport widths.</p>
              <div className="admin-design-field-grid"><label>Tablet scale<input type="number" min="0.5" max="1.2" step="0.05" value={design.responsive.tabletScale} onChange={(event) => updateGroup("responsive", "tabletScale", event.target.value)} /></label><label>Mobile scale<input type="number" min="0.4" max="1.1" step="0.05" value={design.responsive.mobileScale} onChange={(event) => updateGroup("responsive", "mobileScale", event.target.value)} /></label></div>
            </section>

            <section className="admin-design-panel">
              <h2>Existing sections</h2><p>Style only sections that already exist on this page. No new sections or custom code are added.</p>
              <div className="admin-design-sections">{activeProfile.sections.map(([id, label]) => { const section = design.sections[id] || {}; return <details key={id}><summary>{label}</summary><div className="admin-design-field-grid"><label>Background<input type="color" value={section.background || "#222222"} onChange={(event) => updateSection(id, "background", event.target.value)} /></label><label>Text color<input type="color" value={section.text || "#eeeeee"} onChange={(event) => updateSection(id, "text", event.target.value)} /></label><div className="admin-design-wide"><MediaUploadField label="Section image" bucket="backgrounds" value={section.imageUrl || ""} disabled={busy} onChange={({ url }) => updateSection(id, "imageUrl", url)} /></div><label>Image fit<select value={section.imageSize || "cover"} onChange={(event) => updateSection(id, "imageSize", event.target.value)}><option value="cover">Cover</option><option value="contain">Contain</option><option value="auto">Original size</option></select></label><label>Vertical spacing (px)<input type="number" min="0" max="400" value={section.padding ?? ""} placeholder="Keep original" onChange={(event) => updateSection(id, "padding", event.target.value)} /></label><label>Minimum height (px)<input type="number" min="0" max="1600" value={section.minHeight ?? ""} placeholder="Keep original" onChange={(event) => updateSection(id, "minHeight", event.target.value)} /></label><label>Text alignment<select value={section.alignment || ""} onChange={(event) => updateSection(id, "alignment", event.target.value)}><option value="">Keep original</option><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label></div></details>; })}</div>
            </section>
          </div>

          <section className="admin-design-preview" aria-label="Live page preview">
            <div className="admin-design-preview__toolbar"><div><strong>LIVE PAGE PREVIEW</strong><span>{previewPath}</span></div><div className="admin-design-preview__sizes">{["desktop", "tablet", "mobile"].map((mode) => <button type="button" key={mode} className={previewMode === mode ? "is-active" : ""} onClick={() => setPreviewMode(mode)}>{mode.toUpperCase()}</button>)}</div></div>
            <div className={`admin-design-preview__viewport is-${previewMode}`}><iframe key={`${previewUrl}-${previewMode}`} title={`${activeProfile.label} design preview`} src={previewUrl} style={{ width: previewWidth }} /></div>
          </section>
        </div>
      )}
      {picker && <div className="admin-design-picker-backdrop"><div className="admin-design-picker"><MediaLibrary key={picker.kind} picker pickerKind={picker.kind} onSelect={setFont} onClose={() => setPicker(null)} /></div></div>}
    </section>
  );
}
