import { useEffect, useMemo, useState } from "react";
import LandingPage from "../../Pages/Landing/LandingPage";
import { DEFAULT_HOME_CONTENT, cloneHomeContent, normalizeHomeContent } from "../../lib/homeContent";
import { supabase } from "../../lib/supabase";

import MediaUploadField from "../components/MediaUploadField";
const SECTION_LABELS = {
  hero: "Introduction & profile",
  "company-logos": "Worked with",
  "featured-work": "Featured work",
};

function TextField({ label, value, onChange, type = "text", placeholder = "" }) {
  return <label className="admin-home-field"><span>{label}</span><input type={type} inputMode={type === "url" ? "url" : undefined} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, rows = 3 }) {
  return <label className="admin-home-field"><span>{label}</span><textarea rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ImageField({ label, value, onChange, bucket = "images" }) {
  return <MediaUploadField label={label} value={value} bucket={bucket} onChange={({ url }) => onChange(url)} />;
}

export default function HomeEditor() {
  const [page, setPage] = useState(null);
  const [draft, setDraft] = useState(() => cloneHomeContent());
  const [baseline, setBaseline] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [publishConfirmation, setPublishConfirmation] = useState(false);

  const orderedSections = useMemo(() => [...draft].sort((left, right) => left.order - right.order), [draft]);
  const serializedDraft = JSON.stringify(orderedSections);
  const isDirty = Boolean(baseline) && serializedDraft !== baseline;
  const canSave = Boolean(page) && (isDirty || !hasDraft);

  useEffect(() => {
    let active = true;
    async function loadEditor() {
      setIsLoading(true);
      setError("");
      try {
        const { data: pageData, error: pageError } = await supabase
          .from("pages")
          .select("id,title,slug,is_published,sections,updated_at")
          .eq("slug", "home")
          .maybeSingle();
        if (pageError) throw pageError;
        if (!pageData) throw new Error("The Home page record is missing. Apply the existing portfolio schema migration before using this editor.");

        const { data: draftData, error: draftError } = await supabase
          .from("home_page_drafts")
          .select("sections,updated_at")
          .eq("page_slug", "home")
          .maybeSingle();
        if (draftError) {
          if (/home_page_drafts|schema cache|does not exist/i.test(draftError.message || "")) {
            throw new Error("The Home Editor database migration is pending. Apply supabase/migrations/20261030020000_home_page_drafts.sql in Supabase SQL Editor.");
          }
          throw draftError;
        }

        const initial = normalizeHomeContent(draftData?.sections || (pageData.sections?.length ? pageData.sections : DEFAULT_HOME_CONTENT));
        if (!active) return;
        setPage(pageData);
        setDraft(initial);
        setBaseline(JSON.stringify(initial));
        setHasDraft(Boolean(draftData));
        setStatus(draftData ? `Draft saved ${draftData.updated_at ? `· ${new Date(draftData.updated_at).toLocaleString()}` : ""}`.trim() : pageData.is_published ? "Editing from the published version" : "Using the original homepage content");
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load the Home Editor. Check your connection and admin permissions.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadEditor();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeLeave = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmAdminNavigation = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target || anchor.origin !== window.location.origin || anchor.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved homepage changes. Leave without saving?")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    document.addEventListener("click", confirmAdminNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeave);
      document.removeEventListener("click", confirmAdminNavigation, true);
    };
  }, [isDirty]);

  function updateSection(sectionId, update) {
    setDraft((current) => current.map((section) => section.id === sectionId ? update(section) : section));
    setStatus("");
  }

  function updateContent(sectionId, key, value) {
    updateSection(sectionId, (section) => ({ ...section, content: { ...section.content, [key]: value } }));
  }

  function updateArrayItem(sectionId, key, index, property, value) {
    const section = draft.find((item) => item.id === sectionId);
    const items = [...(section?.content?.[key] || [])];
    items[index] = { ...items[index], [property]: value };
    updateContent(sectionId, key, items);
  }

  function updateVideo(property, value) {
    const section = draft.find((item) => item.id === "featured-work");
    updateContent("featured-work", "video", { ...section.content.video, [property]: value });
  }

  function moveSection(sectionId, direction) {
    const sections = [...orderedSections];
    const index = sections.findIndex((section) => section.id === sectionId);
    const destination = index + direction;
    if (destination < 0 || destination >= sections.length) return;
    const currentOrder = sections[index].order;
    sections[index] = { ...sections[index], order: sections[destination].order };
    sections[destination] = { ...sections[destination], order: currentOrder };
    setDraft(sections);
    setStatus("");
  }

  function restoreSection(sectionId) {
    const defaults = DEFAULT_HOME_CONTENT.find((section) => section.id === sectionId);
    if (!defaults) return;
    updateSection(sectionId, (section) => ({ ...section, content: cloneHomeContent([defaults])[0].content }));
  }

  async function persistDraft() {
    const sections = normalizeHomeContent(orderedSections);
    const { data, error: saveError } = await supabase
      .from("home_page_drafts")
      .upsert({ page_slug: "home", sections, updated_at: new Date().toISOString() }, { onConflict: "page_slug" })
      .select("sections,updated_at")
      .single();
    if (saveError) throw saveError;
    const saved = normalizeHomeContent(data.sections);
    setDraft(saved);
    setBaseline(JSON.stringify(saved));
    setHasDraft(true);
    setStatus(`Draft saved · ${new Date(data.updated_at || Date.now()).toLocaleString()}`);
    return saved;
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    setError("");
    try {
      await persistDraft();
    } catch (saveError) {
      setError(saveError.message || "Could not save the draft. Check your admin session and database migration.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePublish() {
    setPublishConfirmation(false);
    setIsSaving(true);
    setError("");
    try {
      const savedSections = await persistDraft();
      const { data, error: publishError } = await supabase
        .from("pages")
        .update({ sections: savedSections, is_published: true })
        .eq("id", page.id)
        .select("id,is_published,sections,updated_at")
        .single();
      if (publishError) throw publishError;
      setPage(data);
      setStatus("Homepage published. These changes are now live.");
    } catch (publishError) {
      setError(publishError.message || "The draft was saved, but publishing failed. The previous live homepage remains unchanged.");
    } finally {
      setIsSaving(false);
    }
  }

  function addLogo() {
    const section = draft.find((item) => item.id === "company-logos");
    updateContent("company-logos", "logos", [...section.content.logos, { name: "", logoUrl: "", url: "" }]);
  }

  function removeLogo(index) {
    const section = draft.find((item) => item.id === "company-logos");
    updateContent("company-logos", "logos", section.content.logos.filter((_, logoIndex) => logoIndex !== index));
  }

  function previewScrollTo(selector) {
    document.querySelector(`.admin-home-preview ${selector}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderSectionEditor(section, index) {
    const content = section.content;
    const sectionId = section.id;
    return (
      <article className={`admin-home-section${section.enabled ? "" : " is-disabled"}`} key={sectionId}>
        <header className="admin-home-section__header">
          <div className="admin-home-section__title"><span>{String(index + 1).padStart(2, "0")}</span><h2>{SECTION_LABELS[sectionId]}</h2></div>
          <div className="admin-home-section__controls">
            <button type="button" disabled={index === 0} onClick={() => moveSection(sectionId, -1)} aria-label={`Move ${SECTION_LABELS[sectionId]} up`}>↑</button>
            <button type="button" disabled={index === orderedSections.length - 1} onClick={() => moveSection(sectionId, 1)} aria-label={`Move ${SECTION_LABELS[sectionId]} down`}>↓</button>
            <label className="admin-home-toggle"><input type="checkbox" checked={section.enabled} onChange={(event) => updateSection(sectionId, (current) => ({ ...current, enabled: event.target.checked }))} /><span>{section.enabled ? "Enabled" : "Hidden"}</span></label>
            <button className="admin-home-section__restore" type="button" onClick={() => restoreSection(sectionId)}>RESTORE DEFAULTS</button>
          </div>
        </header>

        {sectionId === "hero" && (
          <div className="admin-home-fields">
            <div className="admin-home-field-grid">
              <TextField label="Name in side rail" value={content.railName} onChange={(value) => updateContent(sectionId, "railName", value)} />
              <TextField label="Side rail initials" value={content.initials} onChange={(value) => updateContent(sectionId, "initials", value)} />
              <TextField label="Page label" value={content.pageLabel} onChange={(value) => updateContent(sectionId, "pageLabel", value)} />
              <TextField label="Header role" value={content.headerRole} onChange={(value) => updateContent(sectionId, "headerRole", value)} />
              <TextField label="Small heading" value={content.eyebrow} onChange={(value) => updateContent(sectionId, "eyebrow", value)} />
              <TextField label="Experience number" value={content.statValue} onChange={(value) => updateContent(sectionId, "statValue", value)} />
              <TextField label="Experience caption" value={content.statCaption} onChange={(value) => updateContent(sectionId, "statCaption", value)} />
              <TextField label="Main heading" value={content.title} onChange={(value) => updateContent(sectionId, "title", value)} />
              <TextField label="Accent heading" value={content.accentTitle} onChange={(value) => updateContent(sectionId, "accentTitle", value)} />
            </div>
            <TextArea label="Description — first line" value={content.descriptionHighlight} onChange={(value) => updateContent(sectionId, "descriptionHighlight", value)} />
            <TextArea label="Description — continuation" value={content.descriptionContinuation} onChange={(value) => updateContent(sectionId, "descriptionContinuation", value)} rows={2} />
            <ImageField label="Profile image" value={content.profileImageUrl} onChange={(value) => updateContent(sectionId, "profileImageUrl", value)} />

            <div className="admin-home-subsection"><h3>Navigation links</h3>{content.navigation.map((item, itemIndex) => <div className="admin-home-repeat-row" key={`nav-${itemIndex}`}><TextField label={`Link ${itemIndex + 1} label`} value={item.label} onChange={(value) => updateArrayItem(sectionId, "navigation", itemIndex, "label", value)} /><TextField label="Destination URL" type="url" value={item.href} onChange={(value) => updateArrayItem(sectionId, "navigation", itemIndex, "href", value)} /></div>)}</div>

            <div className="admin-home-subsection"><h3>Profile details</h3>{content.details.map((item, itemIndex) => <div className="admin-home-repeat-row" key={`detail-${itemIndex}`}><TextField label={`Detail ${itemIndex + 1}`} value={item.label} onChange={(value) => updateArrayItem(sectionId, "details", itemIndex, "label", value)} /><TextField label="Right-side tag" value={item.value} onChange={(value) => updateArrayItem(sectionId, "details", itemIndex, "value", value)} /></div>)}</div>

            <div className="admin-home-subsection"><h3>Buttons</h3><div className="admin-home-repeat-row"><TextField label="Primary button label" value={content.buttonLabel} onChange={(value) => updateContent(sectionId, "buttonLabel", value)} /><TextField label="Primary button URL" type="url" value={content.buttonHref} onChange={(value) => updateContent(sectionId, "buttonHref", value)} /></div><div className="admin-home-repeat-row"><TextField label="Secondary button label" value={content.secondaryButtonLabel} onChange={(value) => updateContent(sectionId, "secondaryButtonLabel", value)} /><TextField label="Secondary button URL" type="url" value={content.secondaryButtonHref} onChange={(value) => updateContent(sectionId, "secondaryButtonHref", value)} /></div></div>
          </div>
        )}

        {sectionId === "company-logos" && (
          <div className="admin-home-fields">
            <TextField label="Section heading" value={content.title} onChange={(value) => updateContent(sectionId, "title", value)} />
            {content.logos.map((logo, logoIndex) => (
              <div className="admin-home-logo-row" key={`logo-${logoIndex}`}>
                <div className="admin-home-field-grid"><TextField label={`Company ${logoIndex + 1}`} value={logo.name} onChange={(value) => updateArrayItem(sectionId, "logos", logoIndex, "name", value)} /><TextField label="Company website (optional)" type="url" value={logo.url} onChange={(value) => updateArrayItem(sectionId, "logos", logoIndex, "url", value)} /></div>
                <ImageField label="Company logo" value={logo.logoUrl} bucket="logos" onChange={(value) => updateArrayItem(sectionId, "logos", logoIndex, "logoUrl", value)} />
                <button className="admin-home-remove" type="button" onClick={() => removeLogo(logoIndex)}>REMOVE COMPANY</button>
              </div>
            ))}
            <button className="admin-home-add" type="button" onClick={addLogo}>+ ADD A COMPANY LOGO</button>
          </div>
        )}

        {sectionId === "featured-work" && (
          <div className="admin-home-fields">
            <div className="admin-home-field-grid"><TextField label="Small heading" value={content.eyebrow} onChange={(value) => updateContent(sectionId, "eyebrow", value)} /><TextField label="Section heading" value={content.title} onChange={(value) => updateContent(sectionId, "title", value)} /><TextField label="Work button label" value={content.moreLabel} onChange={(value) => updateContent(sectionId, "moreLabel", value)} /></div>
            <div className="admin-home-subsection"><h3>Featured video</h3><TextField label="Video title" value={content.video.title} onChange={(value) => updateVideo("title", value)} /><div className="admin-home-field-grid"><TextField label="Video link" type="url" value={content.video.url} onChange={(value) => updateVideo("url", value)} /><label className="admin-home-field"><span>Video source</span><select value={content.video.provider || ""} onChange={(event) => updateVideo("provider", event.target.value)}><option value="">Auto-detect from link</option><option value="youtube">YouTube</option><option value="vimeo">Vimeo</option><option value="google_drive">Google Drive</option><option value="direct">Direct video file</option><option value="cloudflare">Cloudflare Stream</option></select></label></div><div className="admin-home-field-grid"><TextField label="Client (optional)" value={content.video.client} onChange={(value) => updateVideo("client", value)} /><TextField label="Year (optional)" value={content.video.year} onChange={(value) => updateVideo("year", value)} /></div><TextArea label="Video description (optional)" value={content.video.description} onChange={(value) => updateVideo("description", value)} rows={2} /><small className="admin-video-help">The portfolio banner uses the source video thumbnail first. Upload a fallback thumbnail only if the video source has none.</small><ImageField label="Fallback thumbnail (optional)" value={content.video.thumbnail} bucket="thumbnails" onChange={(value) => updateVideo("thumbnail", value)} /></div>
          </div>
        )}
      </article>
    );
  }

  if (isLoading) return <main className="admin-auth-check" role="status">Loading homepage content…</main>;

  return (
    <section className="admin-home-editor" aria-labelledby="admin-home-title">
      <div className="admin-page-heading admin-home-heading">
        <div><p className="admin-page-heading__eyebrow">CONTENT / HOMEPAGE</p><h1 id="admin-home-title">Home <em>Editor.</em></h1><p className="admin-home-intro">Update the content visitors see on the homepage. Save a draft to keep changes private, then preview or publish when you’re ready.</p></div>
        <span className="admin-page-heading__folio">01 — 09</span>
      </div>

      {status && <p className="admin-home-status" role="status"><span className={page?.is_published ? "is-live" : ""} />{status}{isDirty && <em> · Unsaved changes</em>}</p>}
      {error && <p className="admin-alert" role="alert">{error}</p>}

      {!page ? (
        <div className="admin-media-state admin-media-state--error">The Home Editor could not connect to the Home page record. Check the message above and your Supabase setup.</div>
      ) : (
        <>
          <div className="admin-home-sections">{orderedSections.map(renderSectionEditor)}</div>
          <div className="admin-home-actions">
            <span>{hasDraft ? "Draft changes are private until published." : "Your changes have not been saved as a draft yet."}</span>
            <div><button type="button" onClick={() => setIsPreviewOpen(true)}>PREVIEW</button><button type="button" onClick={handleSaveDraft} disabled={!canSave || isSaving}>{isSaving ? "SAVING…" : "SAVE DRAFT"}</button><button className="is-publish" type="button" onClick={() => setPublishConfirmation(true)} disabled={isSaving}>{isSaving ? "WORKING…" : "PUBLISH HOMEPAGE"}</button></div>
          </div>
        </>
      )}

      {publishConfirmation && (
        <div className="admin-media-dialog-backdrop">
          <section className="admin-media-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-home-publish-title" aria-describedby="admin-home-publish-warning">
            <p className="admin-page-heading__eyebrow">PUBLISH HOMEPAGE</p><h2 id="admin-home-publish-title">Make these changes live?</h2><p id="admin-home-publish-warning">This replaces the current public homepage content with the draft shown here. The saved draft will remain available to edit.</p><div><button type="button" onClick={() => setPublishConfirmation(false)}>CANCEL</button><button className="is-danger" type="button" onClick={handlePublish}>PUBLISH NOW</button></div>
          </section>
        </div>
      )}

      {isPreviewOpen && (
        <div className="admin-home-preview" role="dialog" aria-modal="true" aria-label="Homepage draft preview">
          <header className="admin-home-preview__bar"><span>PREVIEW / {isDirty ? "UNSAVED CHANGES" : "SAVED DRAFT"}</span><button type="button" onClick={() => setIsPreviewOpen(false)}>CLOSE PREVIEW <span aria-hidden="true">×</span></button></header>
          <LandingPage homeContent={orderedSections} onShowWork={() => previewScrollTo("#selected-work-section")} onShowMoreWork={() => previewScrollTo("#selected-work-section")} onShowAbout={() => previewScrollTo("#about")} onShowContact={() => previewScrollTo("#contact")} />
        </div>
      )}
    </section>
  );
}
