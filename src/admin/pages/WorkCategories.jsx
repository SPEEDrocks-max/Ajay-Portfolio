import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { categories as staticCategories } from "../../data/categories";
import { clearPublishedCategoriesCache } from "../../lib/categories";
import { supabase } from "../../lib/supabase";

import MediaUploadField from "../components/MediaUploadField";
const STATIC_BY_SLUG = Object.fromEntries(staticCategories.map((category) => [category.slug, category]));
const PROTECTED_SLUGS = new Set(staticCategories.map((category) => category.slug));
const CATEGORY_FIELDS = "id,title,slug,description,thumbnail_url,display_order,is_visible,created_at,updated_at";

function normalizeSlugInput(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "").replace(/--+/g, "-");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function getErrorMessage(error, action = "save categories") {
  if (error?.code === "23505") return "That URL slug is already in use. Choose a unique slug.";
  if (error?.code === "23503") return "This category still has videos assigned to it. Reassign them before deleting the category.";
  if (error?.code === "42501" || error?.status === 401 || error?.status === 403) return "Your admin session may have expired, or the categories permission policy is missing.";
  return error?.message || `Could not ${action}. Please try again.`;
}

function normalizeRow(row, index) {
  const fallback = STATIC_BY_SLUG[row.slug];
  return {
    ...row,
    title: row.title || "",
    slug: row.slug || "",
    description: row.description || "",
    thumbnail_url: row.thumbnail_url || "",
    display_order: Number.isFinite(row.display_order) ? row.display_order : index + 1,
    is_visible: row.is_visible !== false,
    fallbackThumbnail: fallback?.thumbnail || "",
  };
}

function CategoryRow({ category, index, count, onChange, onMove, onDelete, saving }) {
  const canonical = PROTECTED_SLUGS.has(category.slug);
  const preview = category.thumbnail_url || category.fallbackThumbnail;
  return (
    <article className={`admin-category-row${category.is_visible ? "" : " is-hidden"}`}>
      <header className="admin-category-row__header">
        <div className="admin-category-row__order"><span>{String(index + 1).padStart(2, "0")}</span><strong>{category.id ? "SAVED CATEGORY" : "NEW CATEGORY"}</strong></div>
        <div className="admin-category-row__actions">
          <label className="admin-home-toggle"><input type="checkbox" checked={category.is_visible} disabled={saving} onChange={(event) => onChange("is_visible", event.target.checked)} />{category.is_visible ? "Published" : "Hidden"}</label>
          <button type="button" aria-label={`Move ${category.title || "category"} up`} disabled={index === 0 || saving} onClick={() => onMove(index, -1)}>↑</button>
          <button type="button" aria-label={`Move ${category.title || "category"} down`} disabled={index === count - 1 || saving} onClick={() => onMove(index, 1)}>↓</button>
          <button className="is-danger" type="button" disabled={saving || canonical} title={canonical ? "The original categories are protected to preserve their existing routes and video collections." : "Delete this category"} onClick={onDelete}>{canonical ? "PROTECTED" : "DELETE"}</button>
        </div>
      </header>
      <div className="admin-category-row__body">
        <div className="admin-category-image">
          <MediaUploadField label="Category thumbnail" bucket="thumbnails" value={category.thumbnail_url || preview} disabled={saving} onChange={({ url }) => onChange("thumbnail_url", url)} />
        </div>
        <div className="admin-category-fields">
          <label className="admin-home-field"><span>Category name</span><input value={category.title} disabled={saving} maxLength={100} onChange={(event) => onChange("title", event.target.value)} placeholder="e.g. AI Videos" /></label>
          <label className="admin-home-field"><span>URL slug {canonical && <small>· EXISTING SLUG LOCKED</small>}</span><input value={category.slug} disabled={saving} readOnly={canonical} maxLength={100} onChange={(event) => onChange("slug", normalizeSlugInput(event.target.value))} placeholder="category-slug" /></label>
          <label className="admin-home-field admin-category-fields__description"><span>Description <small>· OPTIONAL</small></span><textarea value={category.description} disabled={saving} rows={3} maxLength={500} onChange={(event) => onChange("description", event.target.value)} placeholder="A short introduction shown on the category page" /></label>
          <label className="admin-home-field"><span>Display order</span><input type="number" min="1" step="1" disabled={saving} value={category.display_order} onChange={(event) => onChange("display_order", event.target.value === "" ? "" : Number(event.target.value))} /></label>
          <div className="admin-category-meta"><span>Created {formatDate(category.created_at)}</span><span>Updated {formatDate(category.updated_at)}</span></div>
        </div>
      </div>
    </article>
  );
}

export default function WorkCategories() {
  const [categories, setCategories] = useState([]);
  const [baseline, setBaseline] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const serialized = JSON.stringify(categories);
  const isDirty = Boolean(baseline) && serialized !== baseline;
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => (Number(a.display_order) || 0) - (Number(b.display_order) || 0)), [categories]);

  async function loadCategories() {
    setIsLoading(true);
    setError("");
    try {
      const { data, error: loadError } = await supabase.from("categories").select(CATEGORY_FIELDS).order("display_order", { ascending: true }).order("created_at", { ascending: true });
      if (loadError) throw loadError;
      const loaded = (data || []).map(normalizeRow);
      setCategories(loaded);
      setBaseline(JSON.stringify(loaded));
      if (!loaded.length) setNotice("No category records were found. Apply the Phase 6 seed migration to add the eight existing categories safely.");
    } catch (loadError) {
      setError(getErrorMessage(loadError, "load categories"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadCategories(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isDirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    const confirmNavigation = (event) => {
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target) return;
      const target = new URL(anchor.href, window.location.href);
      if (target.pathname === window.location.pathname && target.search === window.location.search) return;
      if (!window.confirm("You have unsaved category changes. Leave without saving?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", confirmNavigation, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", confirmNavigation, true); };
  }, [isDirty]);

  function updateCategory(index, field, value) {
    setCategories((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
    setNotice("");
  }

  function moveCategory(index, direction) {
    const reordered = [...sortedCategories];
    const nextIndex = index + direction;
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    setCategories(reordered.map((item, orderIndex) => ({ ...item, display_order: orderIndex + 1 })));
  }

  function addCategory() {
    const newCategory = normalizeRow({ id: null, title: "", slug: "", description: "", thumbnail_url: "", display_order: categories.length + 1, is_visible: false }, categories.length);
    setCategories((items) => [...items, newCategory]);
    setNotice("New categories start hidden. Set their details, then publish when ready.");
  }

  async function saveCategories() {
    setError("");
    setNotice("");
    const prepared = sortedCategories.map((category) => ({ ...category, title: category.title.trim(), slug: category.slug.trim(), description: category.description.trim() || null, thumbnail_url: category.thumbnail_url.trim() || null, display_order: Number(category.display_order) }));
    const duplicateSlug = prepared.find((category, index) => prepared.findIndex((other) => other.slug === category.slug) !== index);
    const duplicateOrder = prepared.find((category, index) => prepared.findIndex((other) => other.display_order === category.display_order) !== index);
    const invalid = prepared.find((category) => !category.title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category.slug) || !Number.isInteger(category.display_order) || category.display_order < 1);
    if (invalid) return setError(`Check “${invalid.title || "New category"}”: name, a lowercase URL slug, and a positive whole-number display order are required.`);
    if (duplicateSlug) return setError(`The slug “${duplicateSlug.slug}” is used more than once. Each category needs a unique slug.`);
    if (duplicateOrder) return setError(`Display order ${duplicateOrder.display_order} is assigned more than once. Give each category a unique order.`);
    if (prepared.some((category) => category.id && PROTECTED_SLUGS.has(category.slug) && category.slug !== categories.find((entry) => entry.id === category.id)?.slug)) return setError("The eight existing category slugs must remain unchanged.");
    setIsSaving(true);
    try {
      for (const category of prepared) {
        const payload = { title: category.title, slug: category.slug, description: category.description, thumbnail_url: category.thumbnail_url, display_order: category.display_order, is_visible: category.is_visible };
        const request = category.id
          ? supabase.from("categories").update(payload).eq("id", category.id).select("id").single()
          : supabase.from("categories").insert(payload).select("id").single();
        const { data: savedRow, error: saveError } = await request;
        if (saveError) throw saveError;
        if (!savedRow?.id) throw new Error(`Supabase did not confirm saving “${category.title}”. Reload the category list and check admin access.`);
      }
      clearPublishedCategoriesCache();
      await loadCategories();
      setNotice("Category changes saved. Public visitors only see published categories.");
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCategory(category) {
    if (!category.id) {
      setCategories((items) => items.filter((item) => item !== category));
      return;
    }
    if (isDirty) return setError("Save your category changes before deleting a saved category so no edits are lost.");
    if (PROTECTED_SLUGS.has(category.slug)) return setError("The eight original categories are protected to preserve their existing URLs and video collections.");
    setError("");
    setNotice("");
    const { count, error: countError } = await supabase.from("videos").select("id", { count: "exact", head: true }).eq("category_id", category.id);
    if (countError) return setError(getErrorMessage(countError, "check the category’s assigned videos"));
    if (count > 0) return setError(`“${category.title}” has ${count} assigned video${count === 1 ? "" : "s"}. Reassign them in a future Video Manager before deleting this category.`);
    if (!window.confirm(`Delete “${category.title}”? This cannot be undone. No videos are assigned to it.`)) return;
    const { error: deleteError } = await supabase.from("categories").delete().eq("id", category.id);
    if (deleteError) return setError(getErrorMessage(deleteError, "delete the category"));
    clearPublishedCategoriesCache();
    const next = categories.filter((item) => item.id !== category.id);
    setCategories(next);
    setBaseline(JSON.stringify(next));
    setNotice(`“${category.title}” deleted.`);
  }

  return (
    <section className="admin-work-categories" aria-labelledby="admin-work-categories-title">
      <header className="admin-page-heading">
        <div><p className="admin-page-heading__eyebrow">PORTFOLIO STRUCTURE / WORK</p><h1 id="admin-work-categories-title">Work <em>page.</em></h1><p className="admin-home-intro">Manage work categories and their thumbnails. Existing video collections remain connected to their original categories.</p><Link className="admin-related-page-link" to="/video-manager">Manage videos <span aria-hidden="true">↗</span></Link></div>
        <span className="admin-page-heading__folio">03 — 09</span>
      </header>
      {error && <div className="admin-alert admin-alert--dashboard" role="alert">{error}</div>}
      {notice && <p className="admin-category-notice" role="status">{notice}</p>}
      <div className="admin-category-toolbar"><span>{categories.length} {categories.length === 1 ? "CATEGORY" : "CATEGORIES"} <i>·</i> SAVED DIRECTLY TO SUPABASE</span><div><button className="admin-home-add" type="button" onClick={addCategory} disabled={isSaving}>+ ADD CATEGORY</button><button className="admin-category-save" type="button" onClick={saveCategories} disabled={isLoading || isSaving || !isDirty}>{isSaving ? "SAVING…" : "SAVE CHANGES"}</button></div></div>
      {isLoading ? <div className="admin-media-state" role="status"><span className="admin-media-spinner" />Loading categories…</div> : categories.length ? <div className="admin-category-list">{sortedCategories.map((category, index) => {
        const sourceIndex = categories.findIndex((item) => item === category || (item.id && item.id === category.id));
        return <CategoryRow key={category.id || `new-${index}`} category={category} index={index} count={sortedCategories.length} saving={isSaving} onChange={(field, value) => updateCategory(sourceIndex, field, value)} onMove={moveCategory} onDelete={() => void deleteCategory(category)} />;
      })}</div> : <div className="admin-media-state"><span>WORK / CATEGORIES</span><strong>No categories found</strong><p>Apply the Phase 6 seed migration to restore the eight existing categories without overwriting existing records.</p></div>}
      <div className="admin-category-savebar"><span>{isDirty ? "Unsaved changes" : "All changes saved"}{sortedCategories.length > 0 && ` · ${sortedCategories.filter((category) => category.is_visible).length} published`}</span><button className="admin-category-save" type="button" onClick={saveCategories} disabled={isLoading || isSaving || !isDirty}>{isSaving ? "SAVING…" : "SAVE CHANGES"}</button></div>
    </section>
  );
}
