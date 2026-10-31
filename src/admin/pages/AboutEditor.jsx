import { useEffect, useMemo, useState } from "react";
import AboutPage from "../../Pages/About/AboutPage";
import { DEFAULT_ABOUT_CONTENT, cloneAboutContent, normalizeAboutContent, serializeAboutContent } from "../../lib/aboutContent";
import { supabase } from "../../lib/supabase";

import MediaUploadField from "../components/MediaUploadField";
const LIST_LABELS = { experiences: "experience", tools: "tool", specializations: "specialization" };

function TextField({ label, value, onChange, type = "text", placeholder = "" }) {
  return <label className="admin-home-field"><span>{label}</span><input type={type} inputMode={type === "url" ? "url" : undefined} value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></label>;
}

function TextArea({ label, value, onChange, rows = 3 }) {
  return <label className="admin-home-field"><span>{label}</span><textarea rows={rows} value={value ?? ""} onChange={(event) => onChange(event.target.value)} /></label>;
}

function ImageField({ label, value, onChange, bucket = "images" }) {
  return <MediaUploadField label={label} value={value} bucket={bucket} onChange={({ url }) => onChange(url)} />;
}

function draftErrorMessage(error) {
  if (error?.code === "23514" || /home_page_drafts_(home_only|supported_page)/i.test(error?.message || "")) {
    return "The About draft migration is pending. Run migrations/20261030020000_home_page_drafts.sql and migrations/20261030030000_enable_about_page_drafts.sql in order.";
  }
  if (/home_page_drafts|schema cache|does not exist/i.test(error?.message || "")) {
    return "About drafts need the Phase 4 and Phase 5 database migrations. Apply both in order as described in supabase/SETUP.md.";
  }
  return error?.message || "Could not save the draft. Check your admin session and database migrations.";
}

export default function AboutEditor() {
  const [page, setPage] = useState(null);
  const [draft, setDraft] = useState(() => cloneAboutContent());
  const [baseline, setBaseline] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [publishConfirmation, setPublishConfirmation] = useState(false);

  const visibleExperiences = useMemo(() => [...draft.experiences].sort((a, b) => (Number(b.sortOrder) || 0) - (Number(a.sortOrder) || 0)), [draft.experiences]);
  const serializedDraft = JSON.stringify(draft);
  const isDirty = Boolean(baseline) && serializedDraft !== baseline;
  const canSave = Boolean(page) && (isDirty || !hasDraft);

  useEffect(() => {
    let active = true;
    async function loadEditor() {
      setIsLoading(true);
      setError("");
      try {
        const { data: pageData, error: pageError } = await supabase.from("pages")
          .select("id,title,slug,is_published,sections,updated_at").eq("slug", "about").maybeSingle();
        if (pageError) throw pageError;
        if (!pageData) throw new Error("The About page record is missing. Apply the portfolio schema migration before using this editor.");

        const { data: draftData, error: draftError } = await supabase.from("home_page_drafts")
          .select("sections,updated_at").eq("page_slug", "about").maybeSingle();
        if (draftError) {
          if (/home_page_drafts|schema cache|does not exist/i.test(draftError.message || "")) {
            throw new Error("About drafts need the Phase 4 and Phase 5 database migrations. Apply the migrations in order as described in supabase/SETUP.md.");
          }
          throw draftError;
        }

        const initial = normalizeAboutContent(draftData?.sections || (pageData.sections?.length ? pageData.sections : DEFAULT_ABOUT_CONTENT));
        if (!active) return;
        setPage(pageData);
        setDraft(initial);
        setBaseline(JSON.stringify(initial));
        setHasDraft(Boolean(draftData));
        setStatus(draftData ? `Draft saved ${draftData.updated_at ? `· ${new Date(draftData.updated_at).toLocaleString()}` : ""}`.trim() : pageData.is_published ? "Editing from the published version" : "Using the existing About page content");
      } catch (loadError) {
        if (active) setError(loadError.message || "Could not load the About Editor. Check the connection and admin permissions.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadEditor();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeLeave = (event) => { event.preventDefault(); event.returnValue = ""; };
    const confirmAdminNavigation = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (!window.confirm("You have unsaved About page changes. Leave without saving?")) {
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

  function updateField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
    setStatus("");
  }

  function updateEntry(collection, index, key, value) {
    setDraft((current) => ({ ...current, [collection]: current[collection].map((entry, entryIndex) => entryIndex === index ? { ...entry, [key]: value } : entry) }));
    setStatus("");
  }

  function addEntry(collection) {
    const sortOrder = draft[collection].length ? Math.max(...draft[collection].map((item) => Number(item.sortOrder) || 0)) + 1 : 0;
    const base = collection === "experiences" ? { company: "", role: "", description: "", logo: "" }
      : collection === "tools" ? { name: "", logo: "", initiallyVisible: true, importance: 1 }
        : { title: "", description: "" };
    setDraft((current) => ({ ...current, [collection]: [...current[collection], { id: crypto.randomUUID(), ...base, sortOrder }] }));
    setStatus("");
  }

  function moveEntry(collection, index, direction) {
    const entries = collection === "experiences" ? [...visibleExperiences] : [...draft[collection]];
    const destination = index + direction;
    if (destination < 0 || destination >= entries.length) return;
    [entries[index], entries[destination]] = [entries[destination], entries[index]];
    entries.forEach((entry, order) => { entry.sortOrder = collection === "experiences" ? entries.length - order - 1 : order; });
    setDraft((current) => ({ ...current, [collection]: entries }));
    setStatus("");
  }

  function confirmDeleteEntry() {
    if (!deleteTarget) return;
    setDraft((current) => {
      const remaining = current[deleteTarget.collection].filter((_, index) => index !== deleteTarget.index);
      if (deleteTarget.collection === "experiences") {
        remaining.sort((a, b) => (Number(b.sortOrder) || 0) - (Number(a.sortOrder) || 0));
        remaining.forEach((item, order) => { item.sortOrder = remaining.length - order - 1; });
      } else {
        remaining.forEach((item, order) => { item.sortOrder = order; });
      }
      return { ...current, [deleteTarget.collection]: remaining };
    });
    setDeleteTarget(null);
    setStatus("");
  }

  async function persistDraft() {
    const aboutSections = serializeAboutContent(draft);
    const { data, error: saveError } = await supabase.from("home_page_drafts")
      .upsert({ page_slug: "about", sections: aboutSections, updated_at: new Date().toISOString() }, { onConflict: "page_slug" })
      .select("sections,updated_at").single();
    if (saveError) throw saveError;
    const saved = normalizeAboutContent(data.sections);
    setDraft(saved);
    setBaseline(JSON.stringify(saved));
    setHasDraft(true);
    setStatus(`Draft saved · ${new Date(data.updated_at || Date.now()).toLocaleString()}`);
    return serializeAboutContent(saved);
  }

  function validate() {
    if (draft.experiences.some((item) => !item.company.trim())) return "Add a company name or remove each incomplete experience entry.";
    if (draft.tools.some((item) => !item.name.trim())) return "Add a tool name or remove each incomplete tool entry.";
    if (draft.specializations.some((item) => !item.title.trim())) return "Add a specialization title or remove each incomplete specialization entry.";
    return "";
  }

  async function handleSaveDraft() {
    const validation = validate();
    if (validation) { setError(validation); return; }
    setIsSaving(true);
    setError("");
    try { await persistDraft(); }
    catch (saveError) { setError(draftErrorMessage(saveError)); }
    finally { setIsSaving(false); }
  }

  async function handlePublish() {
    setPublishConfirmation(false);
    const validation = validate();
    if (validation) { setError(validation); return; }
    setIsSaving(true);
    setError("");
    try {
      const sections = await persistDraft();
      const { data, error: publishError } = await supabase.from("pages")
        .update({ sections, is_published: true }).eq("id", page.id)
        .select("id,is_published,sections,updated_at").single();
      if (publishError) throw publishError;
      setPage(data);
      setStatus("About page published. These changes are now live.");
    } catch (publishError) {
      const migrationFailure = publishError?.code === "23514" || /home_page_drafts_(home_only|supported_page)/i.test(publishError?.message || "") || /home_page_drafts|schema cache/i.test(publishError?.message || "");
      setError(migrationFailure ? draftErrorMessage(publishError) : `The draft was saved, but publishing failed. The existing live About page remains unchanged. ${publishError?.message || "Please try again."}`);
    } finally { setIsSaving(false); }
  }

  if (isLoading) return <main className="admin-auth-check" role="status">Loading About page content…</main>;

  return (
    <section className="admin-about-editor" aria-labelledby="admin-about-title">
      <div className="admin-page-heading admin-home-heading"><div><p className="admin-page-heading__eyebrow">CONTENT / ABOUT PAGE</p><h1 id="admin-about-title">About <em>Editor.</em></h1><p className="admin-home-intro">Edit the career timeline, portrait, tools, and focus areas shown on the About page. Save a private draft before publishing.</p></div><span className="admin-page-heading__folio">02 — 09</span></div>
      {status && <p className="admin-home-status" role="status"><span className={page?.is_published ? "is-live" : ""} />{status}{isDirty && <em> · Unsaved changes</em>}</p>}
      {error && <p className="admin-alert" role="alert">{error}</p>}

      {!page ? <div className="admin-media-state admin-media-state--error">The About Editor could not connect to the About page record. Check the message above and your Supabase setup.</div> : (
        <>
          <div className="admin-home-sections">
            <article className="admin-home-section">
              <header className="admin-home-section__header"><div className="admin-home-section__title"><span>01</span><h2>Page heading & portrait</h2></div></header>
              <div className="admin-home-fields">
                <div className="admin-home-field-grid"><TextField label="Top label name" value={draft.topbarName} onChange={(value) => updateField("topbarName", value)} /><TextField label="Top label role" value={draft.topbarRole} onChange={(value) => updateField("topbarRole", value)} /><TextField label="Experience eyebrow" value={draft.experienceEyebrow} onChange={(value) => updateField("experienceEyebrow", value)} /><TextField label="Experience heading" value={draft.experienceTitle} onChange={(value) => updateField("experienceTitle", value)} /></div>
                <TextArea label="Experience introduction" value={draft.experienceIntro} onChange={(value) => updateField("experienceIntro", value)} rows={2} />
                <TextField label="Experience empty message" value={draft.experienceEmptyText} onChange={(value) => updateField("experienceEmptyText", value)} />
                <ImageField label="Portrait image" value={draft.portraitUrl} onChange={(value) => updateField("portraitUrl", value)} />
                <div className="admin-home-field-grid"><TextField label="Portrait alt text" value={draft.portraitAlt} onChange={(value) => updateField("portraitAlt", value)} /><TextField label="Portrait caption" value={draft.portraitCaption} onChange={(value) => updateField("portraitCaption", value)} /><TextField label="Portrait fallback kicker" value={draft.portraitEmptyKicker} onChange={(value) => updateField("portraitEmptyKicker", value)} /><TextField label="Portrait fallback initials" value={draft.portraitInitials} onChange={(value) => updateField("portraitInitials", value)} /><TextField label="Portrait fallback label" value={draft.portraitEmptyCaption} onChange={(value) => updateField("portraitEmptyCaption", value)} /></div>
              </div>
            </article>

            <article className="admin-home-section">
              <header className="admin-home-section__header"><div className="admin-home-section__title"><span>02</span><h2>Career timeline <small>{draft.experiences.length} entries</small></h2></div><button className="admin-home-add" type="button" onClick={() => addEntry("experiences")}>+ ADD EXPERIENCE</button></header>
              <div className="admin-home-fields">{draft.experiences.length ? visibleExperiences.map((item, index) => {
                const sourceIndex = draft.experiences.indexOf(item);
                return <div className="admin-about-entry" key={item.id || `experience-${sourceIndex}`}>
                  <div className="admin-about-entry__toolbar"><strong>EXPERIENCE {String(index + 1).padStart(2, "0")} / PAGE ORDER</strong><div><button type="button" disabled={!index} onClick={() => moveEntry("experiences", index, -1)} aria-label="Move experience up">↑</button><button type="button" disabled={index === visibleExperiences.length - 1} onClick={() => moveEntry("experiences", index, 1)} aria-label="Move experience down">↓</button><button className="is-danger" type="button" onClick={() => setDeleteTarget({ collection: "experiences", index: sourceIndex, label: item.company || "this experience" })}>DELETE</button></div></div>
                  <div className="admin-home-field-grid"><TextField label="Company *" value={item.company} onChange={(value) => updateEntry("experiences", sourceIndex, "company", value)} /><TextField label="Role" value={item.role} onChange={(value) => updateEntry("experiences", sourceIndex, "role", value)} /></div>
                  <TextArea label="Description" value={item.description} onChange={(value) => updateEntry("experiences", sourceIndex, "description", value)} rows={2} />
                  <ImageField label="Company logo (optional)" bucket="logos" value={item.logo} onChange={(value) => updateEntry("experiences", sourceIndex, "logo", value)} />
                </div>;
              }) : <p className="admin-about-empty">There are no career entries yet. Add one to build the timeline.</p>}</div>
            </article>

            <article className="admin-home-section">
              <header className="admin-home-section__header"><div className="admin-home-section__title"><span>03</span><h2>Software tools <small>{draft.tools.length} entries</small></h2></div><button className="admin-home-add" type="button" onClick={() => addEntry("tools")}>+ ADD TOOL</button></header>
              <div className="admin-home-fields">{draft.tools.length ? draft.tools.map((item, index) => (
                <div className="admin-about-entry" key={item.id || `tool-${index}`}>
                  <div className="admin-about-entry__toolbar"><strong>TOOL {String(index + 1).padStart(2, "0")}</strong><div><button type="button" disabled={!index} onClick={() => moveEntry("tools", index, -1)} aria-label="Move tool up">↑</button><button type="button" disabled={index === draft.tools.length - 1} onClick={() => moveEntry("tools", index, 1)} aria-label="Move tool down">↓</button><button className="is-danger" type="button" onClick={() => setDeleteTarget({ collection: "tools", index, label: item.name || "this tool" })}>DELETE</button></div></div>
                  <div className="admin-home-field-grid"><TextField label="Tool name *" value={item.name} onChange={(value) => updateEntry("tools", index, "name", value)} /><label className="admin-home-field">Importance<select value={item.importance ?? 1} onChange={(event) => updateEntry("tools", index, "importance", Number(event.target.value))}><option value="0.75">Subtle</option><option value="1">Standard</option><option value="1.2">Prominent</option><option value="1.35">Most prominent</option></select></label></div>
                  <ImageField label="Tool logo (optional)" bucket="logos" value={item.logo} onChange={(value) => updateEntry("tools", index, "logo", value)} />
                  <label className="admin-home-toggle"><input type="checkbox" checked={item.initiallyVisible !== false} onChange={(event) => updateEntry("tools", index, "initiallyVisible", event.target.checked)} /><span>Show as a primary tool</span></label>
                </div>
              )) : <p className="admin-about-empty">There are no software tools yet. Add the tools shown in the animated cloud.</p>}</div>
            </article>

            <article className="admin-home-section">
              <header className="admin-home-section__header"><div className="admin-home-section__title"><span>04</span><h2>Specializations <small>{draft.specializations.length} entries</small></h2></div><button className="admin-home-add" type="button" onClick={() => addEntry("specializations")}>+ ADD SPECIALIZATION</button></header>
              <div className="admin-home-fields"><div className="admin-home-field-grid"><TextField label="Section heading" value={draft.specializationsTitle} onChange={(value) => updateField("specializationsTitle", value)} /></div>{draft.specializations.length ? draft.specializations.map((item, index) => (
                <div className="admin-about-entry" key={item.id || `specialization-${index}`}>
                  <div className="admin-about-entry__toolbar"><strong>FOCUS {String(index + 1).padStart(2, "0")}</strong><div><button type="button" disabled={!index} onClick={() => moveEntry("specializations", index, -1)} aria-label="Move specialization up">↑</button><button type="button" disabled={index === draft.specializations.length - 1} onClick={() => moveEntry("specializations", index, 1)} aria-label="Move specialization down">↓</button><button className="is-danger" type="button" onClick={() => setDeleteTarget({ collection: "specializations", index, label: item.title || "this specialization" })}>DELETE</button></div></div>
                  <TextField label="Specialization *" value={item.title} onChange={(value) => updateEntry("specializations", index, "title", value)} /><TextArea label="Description" value={item.description} onChange={(value) => updateEntry("specializations", index, "description", value)} rows={2} />
                </div>
              )) : <p className="admin-about-empty">No focus areas are listed yet.</p>}</div>
            </article>

            <article className="admin-home-section">
              <header className="admin-home-section__header"><div className="admin-home-section__title"><span>05</span><h2>Tools section labels</h2></div></header>
              <div className="admin-home-fields"><div className="admin-home-field-grid"><TextField label="Tools heading" value={draft.toolsTitle} onChange={(value) => updateField("toolsTitle", value)} /><TextField label="Heading accent" value={draft.toolsAccent} onChange={(value) => updateField("toolsAccent", value)} /><TextField label="Specializations empty message" value={draft.specializationsEmptyText} onChange={(value) => updateField("specializationsEmptyText", value)} /><TextField label="Tools empty message" value={draft.toolsEmptyText} onChange={(value) => updateField("toolsEmptyText", value)} /></div><div className="admin-home-field-grid"><TextField label="Cloud hint" value={draft.toolsHint} onChange={(value) => updateField("toolsHint", value)} /><TextField label="Cloud open hint" value={draft.toolsOpenHint} onChange={(value) => updateField("toolsOpenHint", value)} /></div><div className="admin-home-field-grid"><TextField label="Experience folio" value={draft.experienceFolio} onChange={(value) => updateField("experienceFolio", value)} /><TextField label="Tools folio" value={draft.toolsFolio} onChange={(value) => updateField("toolsFolio", value)} /><TextField label="Footer name" value={draft.footerName} onChange={(value) => updateField("footerName", value)} /><TextField label="Footer role" value={draft.footerRole} onChange={(value) => updateField("footerRole", value)} /><TextField label="Return button label" value={draft.footerReturnLabel} onChange={(value) => updateField("footerReturnLabel", value)} /></div></div>
            </article>

            <article className="admin-home-section">
              <header className="admin-home-section__header"><div className="admin-home-section__title"><span>06</span><h2>YouTube channel banner</h2></div></header>
              <div className="admin-home-fields"><ImageField label="Fallback thumbnail (optional)" bucket="thumbnails" value={draft.youtubeBannerUrl} onChange={(value) => updateField("youtubeBannerUrl", value)} /></div>
            </article>
          </div>

          <div className="admin-home-actions"><span>{hasDraft ? "Draft changes stay private until published." : "Your changes have not been saved as a draft yet."}</span><div><button type="button" onClick={() => setIsPreviewOpen(true)}>PREVIEW</button><button type="button" disabled={!canSave || isSaving} onClick={handleSaveDraft}>{isSaving ? "SAVING…" : "SAVE DRAFT"}</button><button className="is-publish" type="button" disabled={isSaving} onClick={() => setPublishConfirmation(true)}>{isSaving ? "WORKING…" : "PUBLISH ABOUT PAGE"}</button></div></div>
        </>
      )}


      {deleteTarget && <div className="admin-media-dialog-backdrop"><section className="admin-media-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-about-delete-title"><p className="admin-page-heading__eyebrow">REMOVE ENTRY</p><h2 id="admin-about-delete-title">Delete this {LIST_LABELS[deleteTarget.collection]}?</h2><p className="admin-media-dialog__file">{deleteTarget.label}</p><p>This removes the entry from the draft. The public About page stays unchanged until you publish.</p><div><button type="button" onClick={() => setDeleteTarget(null)}>CANCEL</button><button className="is-danger" type="button" onClick={confirmDeleteEntry}>DELETE ENTRY</button></div></section></div>}

      {publishConfirmation && <div className="admin-media-dialog-backdrop"><section className="admin-media-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-about-publish-title"><p className="admin-page-heading__eyebrow">PUBLISH ABOUT PAGE</p><h2 id="admin-about-publish-title">Make these changes live?</h2><p>This replaces the current public About page content with the draft shown here. Your draft remains available to edit.</p><div><button type="button" onClick={() => setPublishConfirmation(false)}>CANCEL</button><button className="is-danger" type="button" onClick={handlePublish}>PUBLISH NOW</button></div></section></div>}

      {isPreviewOpen && <div className="admin-home-preview" role="dialog" aria-modal="true" aria-label="About page draft preview"><header className="admin-home-preview__bar"><span>ABOUT PREVIEW / {isDirty ? "UNSAVED CHANGES" : "SAVED DRAFT"}</span><button type="button" onClick={() => setIsPreviewOpen(false)}>CLOSE PREVIEW <span aria-hidden="true">×</span></button></header><AboutPage isActive content={draft} onBack={() => setIsPreviewOpen(false)} /></div>}
    </section>
  );
}
