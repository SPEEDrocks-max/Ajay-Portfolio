import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { loadPublishedCategories } from "../../lib/categories";
import { DEFAULT_HOME_CONTENT, loadPublishedHomeContent } from "../../lib/homeContent";
import { createDefaultSectionConfig, getSectionPageKey, normalizeSectionConfig, SECTION_TEMPLATES } from "../../lib/pageSections";

const BASE_PAGES = [
  { key: "home", label: "Home", path: "/" },
  { key: "about", label: "About", path: "/about" },
  { key: "work", label: "Work", path: "/work" },
  { key: "category-detail", label: "Category detail default", path: "" },
  { key: "contact", label: "Contact", path: "/contact" },
];

function errorText(error) {
  if (/page_section_(configs|drafts)|schema cache|does not exist/i.test(error?.message || "")) return "The Section Builder migration is pending. Apply supabase/migrations/20261030070000_page_section_builder.sql in the Supabase SQL Editor.";
  if (error?.code === "42501" || error?.status === 401 || error?.status === 403) return "Supabase denied this action. Confirm the admin session and page-section RLS policies.";
  return error?.message || "Could not save the section configuration. Please retry.";
}

function newSectionId(type) {
  const suffix = globalThis.crypto?.randomUUID?.().replaceAll("-", "").slice(0, 12) || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return `${type}-${suffix}`;
}

function reindex(sections) {
  return sections.map((section, order) => ({ ...section, order }));
}

export default function SectionBuilder() {
  const [categories, setCategories] = useState([]);
  const [homeContent, setHomeContent] = useState(DEFAULT_HOME_CONTENT);
  const [ready, setReady] = useState(false);
  const [bootstrapError, setBootstrapError] = useState("");
  const [targetKey, setTargetKey] = useState("home");
  const [sections, setSections] = useState([]);
  const [baseline, setBaseline] = useState("");
  const [hasDraft, setHasDraft] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [previewMode, setPreviewMode] = useState("desktop");
  const [previewKey, setPreviewKey] = useState(0);

  const pageKey = getSectionPageKey(targetKey);
  const templates = SECTION_TEMPLATES[pageKey] || [];
  const selectedPage = useMemo(() => {
    if (targetKey.startsWith("category:")) {
      const slug = targetKey.slice("category:".length);
      return { key: targetKey, label: `Category / ${categories.find((item) => item.slug === slug)?.title || slug}`, path: `/work/${slug}` };
    }
    return BASE_PAGES.find((page) => page.key === targetKey) || BASE_PAGES[0];
  }, [targetKey, categories]);
  const orderedSections = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections]);
  const serialized = JSON.stringify(orderedSections);
  const isDirty = Boolean(baseline) && baseline !== serialized;
  const previewPath = selectedPage.path || (categories[0] ? `/work/${categories[0].slug}` : "/work");
  const iframeWidth = previewMode === "mobile" ? "390px" : previewMode === "tablet" ? "768px" : "100%";

  useEffect(() => {
    let active = true;
    const loadPageData = async () => {
      try {
        const [categoryRows, homeRows] = await Promise.all([
          loadPublishedCategories(),
          loadPublishedHomeContent(),
        ]);
        if (!active) return;
        setCategories(categoryRows);
        setHomeContent(homeRows);
      } catch (loadError) {
        if (active) setBootstrapError(errorText(loadError));
      } finally {
        if (active) setReady(true);
      }
    };
    void loadPageData();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true); setError(""); setMessage("");
      try {
        if (!supabase) throw new Error("Supabase is not configured for this project.");
        const [{ data: published, error: publishedError }, { data: draft, error: draftError }, { data: categoryDefault, error: categoryDefaultError }] = await Promise.all([
          supabase.from("page_section_configs").select("sections,is_published,updated_at").eq("target_key", targetKey).eq("is_published", true).maybeSingle(),
          supabase.from("page_section_drafts").select("sections,updated_at").eq("target_key", targetKey).maybeSingle(),
          targetKey.startsWith("category:") ? supabase.from("page_section_configs").select("sections").eq("target_key", "category-detail").eq("is_published", true).maybeSingle() : Promise.resolve({ data: null, error: null }),
        ]);
        if (publishedError) throw publishedError;
        if (draftError) throw draftError;
        if (categoryDefaultError) throw categoryDefaultError;
        const savedSections = normalizeSectionConfig(draft?.sections || published?.sections, targetKey);
        const inheritedSections = normalizeSectionConfig(categoryDefault?.sections, targetKey);
        const initial = savedSections || inheritedSections || createDefaultSectionConfig(targetKey, homeContent);
        if (!active) return;
        setSections(initial);
        setBaseline(JSON.stringify(initial));
        setHasDraft(Boolean(draft));
        setStatus(draft ? `Draft saved · ${new Date(draft.updated_at).toLocaleString()}` : published ? "Published structure loaded" : inheritedSections ? "Inherited from the category detail default" : "Using current page structure");
      } catch (loadError) {
        if (active) { setSections(createDefaultSectionConfig(targetKey, homeContent)); setBaseline(""); setError(errorText(loadError)); }
      } finally { if (active) setLoading(false); }
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [ready, targetKey, homeContent]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeLeave = (event) => { event.preventDefault(); event.returnValue = ""; };
    const confirmAdminNavigation = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target || anchor.origin !== window.location.origin || anchor.pathname === window.location.pathname) return;
      if (!window.confirm("You have unsaved section changes. Leave without saving?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    document.addEventListener("click", confirmAdminNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeave);
      document.removeEventListener("click", confirmAdminNavigation, true);
    };
  }, [isDirty]);

  async function saveDraft() {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!supabase) throw new Error("Supabase is not configured for this project.");
      const { error: saveError } = await supabase.from("page_section_drafts").upsert({ target_key: targetKey, sections: orderedSections }, { onConflict: "target_key" });
      if (saveError) throw saveError;
      const saved = JSON.stringify(orderedSections); setBaseline(saved); setSections(orderedSections); setHasDraft(true); setStatus("Draft saved just now"); setMessage("Draft saved for this page only.");
    } catch (saveError) { setError(errorText(saveError)); }
    finally { setBusy(false); }
  }

  async function publish() {
    setBusy(true); setError(""); setMessage("");
    try {
      if (!supabase) throw new Error("Supabase is not configured for this project.");
      const { error: publishError } = await supabase.from("page_section_configs").upsert({ target_key: targetKey, sections: orderedSections, is_published: true }, { onConflict: "target_key" });
      if (publishError) throw publishError;
      const { error: deleteError } = await supabase.from("page_section_drafts").delete().eq("target_key", targetKey);
      if (deleteError) throw deleteError;
      const saved = JSON.stringify(orderedSections); setBaseline(saved); setSections(orderedSections); setHasDraft(false); setStatus("Published just now"); setMessage("This page’s section structure is live. Other page drafts were not published.");
    } catch (publishError) { setError(errorText(publishError)); }
    finally { setBusy(false); }
  }

  async function discardDraft() {
    if (!window.confirm(`Discard the saved ${selectedPage.label} draft? The currently published structure will remain live.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (!supabase) throw new Error("Supabase is not configured for this project.");
      const { error: discardError } = await supabase.from("page_section_drafts").delete().eq("target_key", targetKey);
      if (discardError) throw discardError;
      const [{ data: published, error: loadError }, { data: categoryDefault, error: defaultError }] = await Promise.all([
        supabase.from("page_section_configs").select("sections").eq("target_key", targetKey).eq("is_published", true).maybeSingle(),
        targetKey.startsWith("category:") ? supabase.from("page_section_configs").select("sections").eq("target_key", "category-detail").eq("is_published", true).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (loadError) throw loadError;
      if (defaultError) throw defaultError;
      const restored = normalizeSectionConfig(published?.sections, targetKey) || normalizeSectionConfig(categoryDefault?.sections, targetKey) || createDefaultSectionConfig(targetKey, homeContent);
      setSections(restored); setBaseline(JSON.stringify(restored)); setHasDraft(false); setStatus("Draft discarded"); setMessage("The saved draft was discarded. Published sections are unchanged.");
    } catch (discardError) { setError(errorText(discardError)); }
    finally { setBusy(false); }
  }

  function addSection(type) {
    const template = templates.find((item) => item.type === type);
    if (!template) return;
    if (template.unique && sections.some((item) => item.type === type)) return;
    const content = {};
    setSections((current) => reindex([...current, { id: newSectionId(type), type, sourceId: template.sourceId || type, enabled: true, order: current.length, content }]));
    setStatus("Unsaved changes"); setMessage("");
  }

  function moveSection(index, direction) {
    const next = [...orderedSections];
    const destination = index + direction;
    if (destination < 0 || destination >= next.length) return;
    if (templates.find((template) => template.type === next[index]?.type)?.fixedLast || templates.find((template) => template.type === next[destination]?.type)?.fixedLast) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    setSections(reindex(next)); setStatus("Unsaved changes"); setMessage("");
  }

  function toggleSection(id) {
    setSections((current) => current.map((section) => section.id === id ? { ...section, enabled: !section.enabled } : section));
    setStatus("Unsaved changes"); setMessage("");
  }

  function updateContent(id, key, value) {
    setSections((current) => current.map((section) => {
      if (section.id !== id) return section;
      const content = { ...section.content };
      if (value.trim()) content[key] = value;
      else delete content[key];
      return { ...section, content };
    }));
    setStatus("Unsaved changes"); setMessage("");
  }

  function duplicateSection(section) {
    const template = templates.find((item) => item.type === section.type);
    if (!template?.duplicateable) return;
    const copy = { ...section, id: newSectionId(section.type), enabled: true, content: { ...section.content } };
    const index = orderedSections.findIndex((item) => item.id === section.id);
    const next = [...orderedSections]; next.splice(index + 1, 0, copy);
    setSections(reindex(next)); setStatus("Unsaved changes"); setMessage("");
  }

  function removeSection(section) {
    const hasCustom = Object.values(section.content || {}).some((value) => String(value).trim());
    const warning = hasCustom ? "This section has custom settings. Removing it will remove those settings from this page structure; its source content and media records will not be deleted." : "This only removes the section from this page structure. Related categories, videos, experience, tools, and media records will not be deleted.";
    if (!window.confirm(`Remove “${templates.find((item) => item.type === section.type)?.label || section.type}” from this page?\n\n${warning}`)) return;
    setSections((current) => reindex(current.filter((item) => item.id !== section.id)));
    setStatus("Unsaved changes"); setMessage("");
  }

  function preview() {
    try {
      sessionStorage.setItem(`portfolio-studio-sections-preview:${targetKey}`, JSON.stringify(orderedSections));
      setPreviewKey((key) => key + 1); setMessage("Preview refreshed with the current section draft."); setError("");
    } catch { setError("Could not prepare the preview in this browser session."); }
  }

  function changePage(event) {
    const nextTarget = event.target.value;
    if (isDirty && !window.confirm("You have unsaved section changes. Switch pages and discard those unsaved changes?")) return;
    setTargetKey(nextTarget);
  }

  const previewUrl = `${previewPath}?studioSectionsPreview=${encodeURIComponent(targetKey)}&preview=${previewKey}`;

  return <section className="admin-section-builder" aria-labelledby="admin-section-builder-title">
    <div className="admin-page-heading"><div><p className="admin-page-heading__eyebrow">PAGE STRUCTURE / SECTION BUILDER</p><h1 id="admin-section-builder-title">Section <em>Builder.</em></h1><p className="admin-section-builder__intro">Arrange, hide, and configure the real sections already available on each page.</p></div><span className="admin-page-heading__folio">07 — 09</span></div>

    <div className="admin-section-toolbar">
      <label>PAGE SELECTOR<select value={targetKey} disabled={!ready || busy} onChange={changePage}>{BASE_PAGES.map((page) => <option key={page.key} value={page.key}>{page.label}</option>)}{categories.map((category) => <option key={category.slug} value={`category:${category.slug}`}>Category / {category.title}</option>)}</select></label>
      <div><strong>{selectedPage.label}</strong><span>{selectedPage.path || "Shared category detail template"}</span></div>
      <div className="admin-section-actions"><button type="button" onClick={saveDraft} disabled={busy || loading || (!isDirty && hasDraft)}>SAVE DRAFT</button><button type="button" onClick={preview} disabled={loading}>PREVIEW DRAFT</button><button className="is-primary" type="button" onClick={publish} disabled={busy || loading}>PUBLISH</button><button className="is-danger" type="button" onClick={discardDraft} disabled={busy || loading || (!hasDraft && !isDirty)}>DISCARD DRAFT</button></div>
    </div>
    <p className="admin-section-status">{status}</p>
    {message && <p className="admin-media-message admin-media-message--success" role="status">{message}</p>}
    {(error || bootstrapError) && <p className="admin-alert" role="alert">{error || bootstrapError}</p>}

    {loading ? <div className="admin-media-state" role="status">Loading this page’s sections…</div> : <div className="admin-section-layout">
      <div className="admin-section-list-wrap">
        <div className="admin-section-list-heading"><div><p className="admin-page-heading__eyebrow">CURRENT PAGE STRUCTURE</p><h2>{orderedSections.filter((item) => item.enabled).length} visible <span>/ {orderedSections.length} total</span></h2></div><span>{hasDraft ? "DRAFT" : "PUBLISHED BASELINE"}</span></div>
        {!orderedSections.length ? <div className="admin-media-state">No sections are in this page draft. Add one from the library below.</div> : <ol className="admin-section-list">
          {orderedSections.map((section, index) => {
            const template = templates.find((item) => item.type === section.type);
            return <li className={`admin-section-card${section.enabled ? "" : " is-hidden"}`} key={section.id}>
              <div className="admin-section-card__top"><span className="admin-section-card__number">{String(index + 1).padStart(2, "0")}</span><div><h3>{template?.label || section.type}</h3><small>{section.enabled ? "VISIBLE ON PAGE" : "HIDDEN ON PAGE"} <i>·</i> ID {section.id.slice(-8)}{template?.fixedLast ? " · STAYS AFTER THE STORY PANELS" : ""}</small></div><div className="admin-section-card__moves"><button type="button" aria-label={`Move ${template?.label} up`} disabled={index === 0 || template?.fixedLast || templates.find((item) => item.type === orderedSections[index - 1]?.type)?.fixedLast} onClick={() => moveSection(index, -1)}>↑</button><button type="button" aria-label={`Move ${template?.label} down`} disabled={index === orderedSections.length - 1 || template?.fixedLast || templates.find((item) => item.type === orderedSections[index + 1]?.type)?.fixedLast} onClick={() => moveSection(index, 1)}>↓</button></div></div>
              {template?.fields?.length ? <div className="admin-section-card__fields">{template.fields.map((field) => <label key={field.key}>{field.label}{field.defaultValue?.includes("\n") || field.key === "description" || field.key === "intro" || field.key === "descriptionContinuation" ? <textarea rows={3} maxLength={2000} placeholder={field.defaultValue || "Leave blank to use current page content"} value={section.content?.[field.key] ?? ""} onChange={(event) => updateContent(section.id, field.key, event.target.value)} /> : <input maxLength={2000} placeholder={field.defaultValue || "Leave blank to use current page content"} value={section.content?.[field.key] ?? ""} onChange={(event) => updateContent(section.id, field.key, event.target.value)} />}</label>)}</div> : <p className="admin-section-card__note">Uses the existing {template?.label.toLowerCase()} component and its current linked records.</p>}
              <div className="admin-section-card__actions"><button type="button" onClick={() => toggleSection(section.id)}>{section.enabled ? "HIDE SECTION" : "SHOW SECTION"}</button>{template?.duplicateable && <button type="button" onClick={() => duplicateSection(section)}>DUPLICATE</button>}<button className="is-danger" type="button" onClick={() => removeSection(section)}>REMOVE</button></div>
            </li>;
          })}
        </ol>}
        <section className="admin-section-library"><p className="admin-page-heading__eyebrow">IMPLEMENTED SECTION LIBRARY</p><h2>Add a section</h2><p>Only working components that already belong to this page are available.</p><div>{templates.map((template) => { const exists = sections.some((section) => section.type === template.type); const disabled = template.unique && exists; return <button key={template.type} type="button" disabled={disabled || busy} onClick={() => addSection(template.type)}><span><strong>{template.label}</strong><small>{template.duplicateable ? "Can be used more than once" : disabled ? "Unique section already added" : "Existing page component"}</small></span><b>{disabled ? "ADDED" : "+ ADD"}</b></button>; })}</div></section>
      </div>

      <section className="admin-section-preview" aria-label="Actual page draft preview"><div className="admin-section-preview__toolbar"><div><strong>ACTUAL PAGE PREVIEW</strong><span>{previewPath}</span></div><div>{["desktop", "tablet", "mobile"].map((mode) => <button type="button" className={previewMode === mode ? "is-active" : ""} key={mode} onClick={() => setPreviewMode(mode)}>{mode.toUpperCase()}</button>)}</div></div><div className={`admin-section-preview__frame is-${previewMode}`}><iframe key={`${previewUrl}-${previewMode}`} src={previewUrl} title={`${selectedPage.label} section preview`} style={{ width: iframeWidth }} /></div></section>
    </div>}
  </section>;
}
